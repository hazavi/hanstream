import '@testing-library/jest-dom';

// Public fixture origins for isolated tests. No local environment or credentials are loaded.
process.env.STREAM_SOURCE_URL = 'https://stream.example';
process.env.METADATA_SOURCE_URL = 'https://metadata.example';
process.env.EDITORIAL_SOURCE_URL = 'https://www.dramaeditorial.com';
process.env.DETAILS_SOURCE_URL = 'https://details.example';
