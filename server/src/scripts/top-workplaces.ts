import axios from 'axios';

// --- 1. DEFINE DATA STRUCTURES ---

// This represents the basic structure of a workplace as returned by the API.
// Each workplace has an ID, a name, and a status (0 = active, 1 = inactive).
interface Workplace {
  id: number;
  name: string;
  status: number;
}

// Each shift represents a work event with an assigned worker (if any).
// Shifts can also be canceled — in that case, 'cancelledAt' will have a value.
interface Shift {
  id: number;
  workplaceId: number;
  workerId: number | null;
  cancelledAt: string | null;
}

// This is the shape of the final data we want to display:
// The name of a workplace and how many valid shifts it has completed.
interface WorkplaceResult {
  name: string;
  shifts: number;
}

// When the API returns data, it does so in a paginated format.
// That means it gives you some results and a link to the next page (if any).
interface PaginatedResponse<T> {
  data: T[];
  links: {
    next: string | null;
  };
}

// The base URL for our API requests
const API_BASE_URL = 'http://localhost:3000';

/**
 * A reusable helper that fetches *all* data from a paginated endpoint.
 * Think of it like this: the API may only give us one page at a time,
 * but this function keeps calling 'next' until we have everything.
 *
 * @param initialUrl - the starting point (first page) for the API call
 * @returns - an array with all items from all the pages
 */
async function fetchAllPaginatedData<T>(initialUrl: string): Promise<T[]> {
    const allItems: T[] = [];
    let nextUrl: string | null = initialUrl;
  
    while (nextUrl) {
      const response: { data: PaginatedResponse<T> } = await axios.get<PaginatedResponse<T>>(nextUrl);
      const { data, links } = response.data;
      allItems.push(...data); // Add current page's data to our master list
      nextUrl = links.next;   // If there's another page, update the loop
    }
  
    return allItems; // Return the full combined dataset
}
  
/**
 * This is the main function — the heart of the script.
 * It pulls the data, filters and processes it, then prints the top 3 workplaces.
 */
async function getTopWorkplaces() {
  try {
    // --- 2. FETCH ALL DATA USING THE PAGINATION HELPER ---
    // In parallel, fetch all workplaces and all shifts from the API
    const [allWorkplaces, allShifts] = await Promise.all([
      fetchAllPaginatedData<Workplace>(`${API_BASE_URL}/workplaces`),
      fetchAllPaginatedData<Shift>(`${API_BASE_URL}/shifts`),
    ]);

    // --- 3. FILTER ACTIVE WORKPLACES & CREATE A LOOKUP MAP ---
    // We only care about workplaces that are 'active' (status === 0)
    // Store them in a Map for quick lookup later using workplaceId
    const activeWorkplaceMap = new Map<number, string>();
    for (const workplace of allWorkplaces) {
      if (workplace.status === 0) {
        activeWorkplaceMap.set(workplace.id, workplace.name);
      }
    }

    // --- 4. IDENTIFY AND COUNT COMPLETED SHIFTS FOR ACTIVE WORKPLACES ---
    // A completed shift is one that:
    // - Has a worker assigned (workerId !== null)
    // - Has NOT been cancelled (cancelledAt === null)
    // Count how many such shifts each active workplace has
    const shiftCounts = new Map<number, number>();
    for (const shift of allShifts) {
      const isCompleted = shift.workerId !== null && shift.cancelledAt === null;

      if (isCompleted && activeWorkplaceMap.has(shift.workplaceId)) {
        const currentCount = shiftCounts.get(shift.workplaceId) || 0;
        shiftCounts.set(shift.workplaceId, currentCount + 1);
      }
    }

    // --- 5. COMBINE, SORT, AND SELECT TOP 3 ---
    // Now that we have counts, map them back to names
    // Then sort in descending order of shift count
    // Finally, take the top 3 entries
    const results: WorkplaceResult[] = [];
    for (const [workplaceId, count] of shiftCounts.entries()) {
      const name = activeWorkplaceMap.get(workplaceId);
      if (name) {
        results.push({ name, shifts: count });
      }
    }

    results.sort((a, b) => b.shifts - a.shifts);
    const top3Workplaces = results.slice(0, 3);

    // --- 6. PRINT THE FINAL RESULT IN THE REQUIRED FORMAT ---
    // Output a nicely formatted JSON array of the top 3 workplaces
    // This should match exactly what the assessment expects
    console.log(JSON.stringify(top3Workplaces, null, 2));

  } catch (error) {
    // --- ERROR HANDLING ---
    // Something went wrong: either server is down or response failed
    console.error("Failed to fetch or process workplace data. Is the server running? `npm start`");
    if (axios.isAxiosError(error)) {
      console.error('Axios error:', error.message);
    } else {
      console.error('An unexpected error occurred:', error);
    }
    process.exit(1); // Exit with error code for CI/testing systems
  }
}

// Run the main function
getTopWorkplaces();
