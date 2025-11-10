import '@testing-library/jest-dom';

// Provide required env so lib/api.ts doesn't throw at import time
if (!process.env.NEXT_PUBLIC_API_BASE_URL) {
	// Use a neutral placeholder; fetch is mocked in tests so value doesn't matter
	process.env.NEXT_PUBLIC_API_BASE_URL = 'https://example.test';
}
