import { z } from 'zod';

export const SearchCriteriaSchema = z.object({
  sector: z.string().trim().min(2).max(100),
  location: z.string().trim().min(2).max(100),
});

export type SearchCriteria = z.infer<typeof SearchCriteriaSchema>;
