# Testing Guide

## Setup Complete ✅

Your Hanstream app is now configured with Vitest for testing!

## Test Results: 53 Passing, 20 Failing (73 total)

### ✅ Fully Passing Tests

- **API Functions** - fetchDrama, fetchEpisode, fetchSearch, fetchRecent, fetchPopular, formatRelativeTime, cache management
- **Breadcrumb Component** - rendering, links, active states
- **VideoPlayer Component** - iframe, src, title, fullscreen
- **DramaCard Component** - recent/popular variants, images, links
- **SearchBar Component** - input, navigation (minor fixes needed)
- **Profile Database** - watchlist, continue watching, rankings operations

### ⚠️ Tests Need Fixes

- **WatchlistButton** - needs proper useProfile mock
- **DramaRatingButton** - needs proper useProfile mock
- **EpisodesNavigation** - CSS class assertion adjustments
- Minor SearchBar URL encoding differences

## Running Tests

### Run all tests (watch mode)

```bash
npm test
```

### Run tests once (CI mode)

```bash
npm test -- --run
```

### Run tests with UI

```bash
npm run test:ui
```

### Run specific test file

```bash
npm test -- api.test.ts
```

### Run tests with coverage

```bash
npm test -- --coverage
```

## Test Structure

- **`__tests__/`** - Contains all test files
  - `api.test.ts` - API functions (53+ assertions)
  - `Breadcrumb.test.tsx` - Breadcrumb component
  - `EpisodesNavigation.test.tsx` - Episodes navigation
  - `VideoPlayer.test.tsx` - Video player
  - `DramaCard.test.tsx` - Drama cards (recent/popular)
  - `SearchBar.test.tsx` - Search functionality
  - `WatchlistButton.test.tsx` - Watchlist operations
  - `DramaRatingButton.test.tsx` - Rating system
  - `profile.test.ts` - Firebase database operations
- **`vitest.config.ts`** - Vitest configuration
- **`vitest.setup.ts`** - Global test setup (jest-dom matchers)

## Writing Tests

### Example: Testing a utility function

```typescript
import { describe, it, expect } from "vitest";
import { myFunction } from "../lib/myFile";

describe("myFunction", () => {
  it("should do something", () => {
    const result = myFunction("input");
    expect(result).toBe("expected output");
  });
});
```

### Example: Testing a React component

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MyComponent from "../components/MyComponent";

// Mock Next.js modules if needed
vi.mock("next/link", () => ({
  default: ({ children, href }) => <a href={href}>{children}</a>,
}));

describe("MyComponent", () => {
  it("should render correctly", () => {
    render(<MyComponent />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
```

## Common Mocking Patterns

### Mock Next.js Link

```typescript
vi.mock("next/link", () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));
```

### Mock Next.js Image

```typescript
vi.mock("next/image", () => ({
  default: (props: any) => <img {...props} alt={props.alt} />,
}));
```

### Mock Next.js Router

```typescript
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => "/",
}));
```

### Mock Firebase

```typescript
vi.mock("firebase/database", () => ({
  getDatabase: vi.fn(),
  ref: vi.fn(),
  set: vi.fn(),
  get: vi.fn(),
  onValue: vi.fn(),
}));
```

### Mock Context Hooks

```typescript
vi.mock("../lib/auth", () => ({
  useAuth: vi.fn(() => ({
    user: { uid: "test-user-123" },
    loading: false,
  })),
}));
```

## Common Testing Utilities

- `render()` - Render a component for testing
- `screen` - Query rendered elements
- `expect()` - Make assertions
- `vi.mock()` - Mock modules/functions
- `fireEvent` - Trigger user interactions
- `waitFor()` - Wait for async operations

## Future Testing Priorities

1. Fix useProfile mock for WatchlistButton & DramaRatingButton
2. Add page component tests (home, drama detail, episode)
3. Add tests for HeroCarousel, TopAiringSection
4. Add integration tests for user flows
5. Increase coverage for edge cases

## Learn More

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library Documentation](https://testing-library.com/react)
- [Jest-DOM Matchers](https://github.com/testing-library/jest-dom)
