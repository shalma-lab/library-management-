// Sample data used instead of a real backend.
// In a real app this would come from an API.

export const initialBooks = [
  {
    id: 1,
    title: "The Midnight Library",
    author: "Matt Haig",
    category: "Fiction",
    year: 2020,
    rating: 4.6,
    totalCopies: 3,
    availableCopies: 1,
    description:
      "Between life and death there is a library, and within that library, the shelves go on forever. Every book gives you a chance to try another life you could have lived.",
  },
  {
    id: 2,
    title: "Sapiens: A Brief History of Humankind",
    author: "Yuval Noah Harari",
    category: "Non-Fiction",
    year: 2011,
    rating: 4.7,
    totalCopies: 4,
    availableCopies: 0,
    description:
      "A sweeping look at how Homo sapiens came to dominate the earth, from the cognitive revolution to the modern age.",
  },
  {
    id: 3,
    title: "Dune",
    author: "Frank Herbert",
    category: "Science Fiction",
    year: 1965,
    rating: 4.8,
    totalCopies: 5,
    availableCopies: 2,
    description:
      "A desert planet, a noble family, and a prophecy collide in the novel that redefined science fiction.",
  },
  {
    id: 4,
    title: "The Silent Patient",
    author: "Alex Michaelides",
    category: "Mystery",
    year: 2019,
    rating: 4.3,
    totalCopies: 2,
    availableCopies: 0,
    description:
      "A woman shoots her husband and never speaks again. A psychotherapist becomes obsessed with uncovering why.",
  },
  {
    id: 5,
    title: "Educated",
    author: "Tara Westover",
    category: "Biography",
    year: 2018,
    rating: 4.7,
    totalCopies: 3,
    availableCopies: 3,
    description:
      "A memoir about a girl who grows up in a survivalist family and the education that transforms her life.",
  },
  {
    id: 6,
    title: "Atomic Habits",
    author: "James Clear",
    category: "Self-Help",
    year: 2018,
    rating: 4.8,
    totalCopies: 6,
    availableCopies: 4,
    description:
      "A proven framework for improving every day, built on the idea that tiny changes compound into big results.",
  },
  {
    id: 7,
    title: "Project Hail Mary",
    author: "Andy Weir",
    category: "Science Fiction",
    year: 2021,
    rating: 4.9,
    totalCopies: 3,
    availableCopies: 1,
    description:
      "A lone astronaut wakes up with no memory, tasked with saving humanity from an extinction-level threat.",
  },
  {
    id: 8,
    title: "Circe",
    author: "Madeline Miller",
    category: "Fantasy",
    year: 2018,
    rating: 4.6,
    totalCopies: 4,
    availableCopies: 2,
    description:
      "The banished witch of Greek myth tells her own story, from the halls of Helios to a lonely island.",
  },
  {
    id: 9,
    title: "Thinking, Fast and Slow",
    author: "Daniel Kahneman",
    category: "Non-Fiction",
    year: 2011,
    rating: 4.5,
    totalCopies: 3,
    availableCopies: 0,
    description:
      "A Nobel laureate explains the two systems that drive how we think and the biases that shape our choices.",
  },
  {
    id: 10,
    title: "The Seven Husbands of Evelyn Hugo",
    author: "Taylor Jenkins Reid",
    category: "Fiction",
    year: 2017,
    rating: 4.7,
    totalCopies: 4,
    availableCopies: 1,
    description:
      "A reclusive Hollywood icon finally tells her life story, unraveling glamour, ambition, and secret loves.",
  },
  {
    id: 11,
    title: "Gone Girl",
    author: "Gillian Flynn",
    category: "Mystery",
    year: 2012,
    rating: 4.4,
    totalCopies: 3,
    availableCopies: 3,
    description:
      "On the day of their fifth anniversary, Nick's wife disappears, and the story he tells starts to unravel.",
  },
  {
    id: 12,
    title: "The Hobbit",
    author: "J.R.R. Tolkien",
    category: "Fantasy",
    year: 1937,
    rating: 4.8,
    totalCopies: 5,
    availableCopies: 2,
    description:
      "A reluctant hobbit is swept into a quest for treasure guarded by a dragon in the tale that started it all.",
  },
];

export const initialMember = {
  id: "M-1001",
  name: "Priya Natarajan",
  memberSince: "2022-03-14",
  membershipTier: "Gold",
  favoriteCategories: ["Science Fiction", "Fiction", "Non-Fiction"],
};

// Helper to build dates relative to today, so due dates always make sense.
const daysFromToday = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

export const initialLoans = [
  { bookId: 3, borrowedOn: daysFromToday(-20), dueDate: daysFromToday(-6), renewals: 0 },
  { bookId: 7, borrowedOn: daysFromToday(-5), dueDate: daysFromToday(9), renewals: 0 },
];

export const initialHistory = [
  { bookId: 6, borrowedOn: daysFromToday(-90), returnedOn: daysFromToday(-76) },
  { bookId: 12, borrowedOn: daysFromToday(-60), returnedOn: daysFromToday(-40) },
  { bookId: 9, borrowedOn: daysFromToday(-140), returnedOn: daysFromToday(-125) },
];

export const LOAN_DAYS = 14;
export const MAX_RENEWALS = 2;
