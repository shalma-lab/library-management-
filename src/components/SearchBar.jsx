import React from "react";

// SearchBar is a small, reusable component for the two search boxes
// (title and author). It doesn't hold any state itself -- the parent
// component passes down the current values and change handlers as props.
// "inputRef" is optional and is used by the parent to auto-focus the
// title box with useRef + useEffect.
function SearchBar({ titleQuery, onTitleChange, authorQuery, onAuthorChange, inputRef }) {
  return (
    <>
      <input
        ref={inputRef}
        type="text"
        placeholder="Search by title or ISBN..."
        value={titleQuery}
        onChange={(e) => onTitleChange(e.target.value)}
        aria-label="Search by title or ISBN"
      />
      <input
        type="text"
        placeholder="Search by author..."
        value={authorQuery}
        onChange={(e) => onAuthorChange(e.target.value)}
        aria-label="Search by author"
      />
    </>
  );
}

export default SearchBar;
