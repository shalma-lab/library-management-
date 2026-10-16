import React from "react";

// FilterPanel is a small, reusable component for category and
// availability filtering. Like SearchBar, it's "controlled" entirely
// through props -- the parent owns the actual filter state.
function FilterPanel({
  categories,
  categoryFilter,
  onCategoryChange,
  availabilityOnly,
  onAvailabilityChange,
  onReset,
}) {
  return (
    <>
      <select value={categoryFilter} onChange={(e) => onCategoryChange(e.target.value)} aria-label="Filter by category">
        {categories.map((category) => (
          <option key={category} value={category}>
            {category === "All" ? "All categories" : category}
          </option>
        ))}
      </select>

      <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <input
          type="checkbox"
          checked={availabilityOnly}
          onChange={(e) => onAvailabilityChange(e.target.checked)}
        />
        Available only
      </label>

      <button className="btn-secondary" onClick={onReset}>
        Clear filters
      </button>
    </>
  );
}

export default FilterPanel;
