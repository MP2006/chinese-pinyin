/** Sample Chinese text for testing */
export const SAMPLE_TEXT = "你好世界";
export const SAMPLE_WORD = "你好";

/** Mock API responses */
export const MOCK_TRANSLATION = "Hello World";

export const MOCK_DEFINITION = {
  word: "你好",
  pinyin: "nǐ hǎo",
  definitions: {
    en: "hello; hi",
  },
};

/** Seed flashcards for testing (matches FlashcardCard type) */
export const SEED_CARDS = [
  {
    id: "card-1",
    user_id: "test-user-id",
    word: "你好",
    pinyin: "nǐ hǎo",
    definitions: { en: "hello" },
    interval: 1,
    ease_factor: 2.5,
    review_count: 0,
    next_review: new Date().toISOString().slice(0, 10),
    last_rating: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "card-2",
    user_id: "test-user-id",
    word: "世界",
    pinyin: "shì jiè",
    definitions: { en: "world" },
    interval: 1,
    ease_factor: 2.5,
    review_count: 1,
    next_review: new Date().toISOString().slice(0, 10),
    last_rating: "good",
    created_at: new Date().toISOString(),
  },
  {
    id: "card-3",
    user_id: "test-user-id",
    word: "谢谢",
    pinyin: "xiè xiè",
    definitions: { en: "thank you" },
    interval: 3,
    ease_factor: 2.6,
    review_count: 2,
    next_review: new Date().toISOString().slice(0, 10),
    last_rating: "easy",
    created_at: new Date().toISOString(),
  },
];

export const MOCK_USER = {
  id: "test-user-id",
  email: "test@example.com",
  user_metadata: { full_name: "Test User" },
  app_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

export const MOCK_SESSION = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: MOCK_USER,
};
