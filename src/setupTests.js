// Jest setup for Experiment 1 (component testing).
// CRA picks this file up automatically via setupFilesAfterEnv.
import "@testing-library/jest-dom";

// React 18 requires this flag for act()-based libraries (React Testing
// Library calls act under the hood).
global.IS_REACT_ACT_ENVIRONMENT = true;
