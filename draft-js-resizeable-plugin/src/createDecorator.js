import React, { Component } from 'react';
import ReactDOM from 'react-dom';

const getDisplayName = (WrappedComponent) => {
  const component = WrappedComponent.WrappedComponent || WrappedComponent;
  return component.displayName || component.name || 'Component';
};

const round = (x, steps) => Math.ceil(x / steps) * steps;

export default ({ config, store }) => (WrappedComponent) => class BlockResizeableDecorator extends Component {
  static displayName = `BlockDraggable(${getDisplayName(WrappedComponent)})`;
  static WrappedComponent = WrappedComponent.WrappedComponent || WrappedComponent;
  static defaultProps = {
    horizontal: 'relative',
    vertical: false,
    resizeSteps: 1,
    ...config
  };
  state = {
    hoverPosition: {},
    clicked: false,
  };

  setEntityData = (data) => {
    this.props.blockProps.setResizeData(data);
  }

  // used to save the hoverPosition so it can be leveraged to determine if a
  // drag should happen on mousedown
  mouseLeave = () => {
    if (!this.state.clicked) {
      this.setState({ hoverPosition: {} });
    }
  }

  // used to save the hoverPosition so it can be leveraged to determine if a
  // drag should happen on mousedown
  mouseMove = (evt) => {
    const { vertical, horizontal } = this.props;

    const hoverPosition = this.state.hoverPosition;
    const tolerance = 6;
    // TODO figure out if and how to achieve this without fetching the DOM node
    // eslint-disable-next-line react/no-find-dom-node
    const pane = ReactDOM.findDOMNode(this);
    const b = pane.getBoundingClientRect();
    const x = evt.clientX - b.left;
    const y = evt.clientY - b.top;

    const isTop = vertical && vertical !== 'auto' ? y < tolerance : false;
    const isLeft = horizontal ? x < tolerance : false;
    const isRight = horizontal ? x >= b.width - tolerance : false;
    const isBottom = vertical && vertical !== 'auto' ? y >= b.height - tolerance && y < b.height : false;

    const canResize = isTop || isLeft || isRight || isBottom;

    const newHoverPosition = {
      isTop, isLeft, isRight, isBottom, canResize
    };
    const hasNewHoverPositions = Object.keys(newHoverPosition).filter(
      (key) => hoverPosition[key] !== newHoverPosition[key]
    );

    if (hasNewHoverPositions.length) {
      this.setState({ hoverPosition: newHoverPosition });
    }
  }

  // Handle mousedown for resizing
  mouseDown = (event) => {
    // No mouse-hover-position data? Nothing to resize!
    if (!this.state.hoverPosition.canResize) {
      return;
    }

    event.preventDefault();
    const { resizeSteps, vertical, horizontal } = this.props;
    const { hoverPosition } = this.state;
    const { isTop, isLeft, isRight, isBottom } = hoverPosition;

    // TODO figure out how to achieve this without fetching the DOM node
    // eslint-disable-next-line react/no-find-dom-node
    const pane = ReactDOM.findDOMNode(this);
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = parseInt(document.defaultView.getComputedStyle(pane).width, 10);
    const startHeight = parseInt(document.defaultView.getComputedStyle(pane).height, 10);

    const imageRect = pane.getBoundingClientRect(); // !
    const imageRatio = imageRect.width / imageRect.height; // ! get image ratio

    // Do the actual drag operation
    const doDrag = (dragEvent) => {
      let width = startWidth + (isLeft ? startX - dragEvent.clientX : dragEvent.clientX - startX);
      const height = startHeight + (isTop ? startY - dragEvent.clientY : dragEvent.clientY - startY);

      const editorComp = store.getEditorRef();
      // this keeps backwards-compatibility with react 15
      const editorNode = editorComp.refs.editor ? editorComp.refs.editor : editorComp.editor;

      width = editorNode.clientWidth < width ? editorNode.clientWidth : width;
      // height = editorNode.clientHeight < height ? editorNode.clientHeight : height; --- I don't believe we should be constrained by height as the document grows if the height exceeds a single page. Also causing bug when dragging by top or bottom with the left/right-align mode on does not grow bigger than editorNode.clientHeight, editorNode.clientHeight being a small number that doesn't make sense

      const widthForPercCalculation = (isTop || isBottom) && vertical === 'relative' ? height * imageRatio : width; // ! calculate new width value in percents

      let widthPerc = (100 / editorNode.clientWidth) * widthForPercCalculation; // !;

      if (widthPerc > 100) {
        widthPerc = 100;
      }
      const newState = {};
      if ((isLeft || isRight) && horizontal === 'relative') {
        newState.width = resizeSteps ? round(widthPerc, resizeSteps) : widthPerc;
      } else if ((isLeft || isRight) && horizontal === 'absolute') {
        newState.width = resizeSteps ? round(width, resizeSteps) : width;
      }

      if ((isTop || isBottom) && vertical === 'relative') {
        newState.width = resizeSteps ? round(widthPerc, resizeSteps) : widthPerc; // ! here we update width not height value
      } else if ((isTop || isBottom) && vertical === 'absolute') {
        newState.height = resizeSteps ? round(height, resizeSteps) : height;
      }

      dragEvent.preventDefault();

      this.setState(newState);
    };

    // Finished dragging
    const stopDrag = () => {
      // TODO clean up event listeners
      document.removeEventListener('mousemove', doDrag, false);
      document.removeEventListener('mouseup', stopDrag, false);

      const { width, height } = this.state;
      this.setState({ clicked: false });
      this.setEntityData({ width, height });
    };

    // TODO clean up event listeners
    document.addEventListener('mousemove', doDrag, false);
    document.addEventListener('mouseup', stopDrag, false);

    this.setState({ clicked: true });
  }

  render() {
    const {
      blockProps,
      vertical,
      horizontal,
      style,
      // using destructuring to make sure unused props are not passed down to the block
      resizeSteps, // eslint-disable-line no-unused-vars
      ...elementProps
    } = this.props;
    const { width, height, hoverPosition } = this.state;
    const { isTop, isLeft, isRight, isBottom } = hoverPosition;

    const styles = { position: 'relative', ...style };

    if (horizontal === 'auto') {
      styles.width = 'auto';
    } else if (horizontal === 'relative') {
      styles.width = `${(width || blockProps.resizeData.width || 40)}%`;
    } else if (horizontal === 'absolute') {
      styles.width = `${(width || blockProps.resizeData.width || 40)}px`;
    }

    if (vertical === 'auto') {
      styles.height = 'auto';
    } else if (vertical === 'relative') {
      styles.height = `${(height || blockProps.resizeData.height || 40)}%`;
    } else if (vertical === 'absolute') {
      styles.height = `${(height || blockProps.resizeData.height || 40)}px`;
    }

    // Handle cursor
    if ((isRight && isBottom) || (isLeft && isTop)) {
      styles.cursor = 'nwse-resize';
    } else if ((isRight && isTop) || (isBottom && isLeft)) {
      styles.cursor = 'nesw-resize';
    } else if (isRight || isLeft) {
      styles.cursor = 'ew-resize';
    } else if (isBottom || isTop) {
      styles.cursor = 'ns-resize';
    } else {
      styles.cursor = 'default';
    }

    const interactionProps = store.getReadOnly()
      ? {}
      : {
        onMouseDown: this.mouseDown,
        onMouseMove: this.mouseMove,
        onMouseLeave: this.mouseLeave,
      };

    return (
      <WrappedComponent
        {...elementProps}
        {...interactionProps}
        blockProps={blockProps}
        ref={(element) => { this.wrapper = element; }}
        style={styles}
      />
    );
  }
};
