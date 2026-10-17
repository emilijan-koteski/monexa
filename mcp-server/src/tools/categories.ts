import { z } from "zod/v4";
import type { Category } from "../api/types.js";
import { defineTool } from "./definition.js";
import {
  categoryTypeSchema,
  CREATE,
  DELETE,
  deletedReply,
  deletedSchema,
  idSchema,
  nameSchema,
  READ,
  requireChanges,
  SINCE_2_0_0,
  UPDATE,
} from "./shared.js";

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export const categorySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  type: categoryTypeSchema,
  description: z.string().nullable(),
  color: z.string().nullable(),
});

const categoryResultSchema = z.object({ category: categorySchema });

const categoryIdSchema = idSchema("Category ID from list_categories.");

const colorSchema = z
  .string()
  .regex(HEX_COLOR_PATTERN, "must be a hex color such as #1976d2")
  .describe("Display color as a hex code, e.g. #1976d2.");

export const listCategories = defineTool({
  name: "list_categories",
  title: "List categories",
  description:
    "Lists the user's categories with their IDs, names, types (INCOME or EXPENSE), descriptions and colors. " +
    "Every record and recurring expense belongs to one category, and the category's type decides whether its amount counts as income or expense.",
  inputSchema: z.object({
    type: categoryTypeSchema.optional().describe("Only return categories of this type."),
  }),
  outputSchema: z.object({ categories: z.array(categorySchema) }),
  annotations: READ,
  covers: ["GET /api/v1/categories"],
  since: SINCE_2_0_0,
  async handler({ type }, api) {
    const categories = await api.get<Category[]>("/categories");
    return { data: { categories: categories.filter((category) => !type || category.type === type) } };
  },
});

export const createCategory = defineTool({
  name: "create_category",
  title: "Create category",
  description: "Creates an income or expense category for classifying records. Returns the new category with its ID.",
  inputSchema: z.object({
    name: nameSchema("Category name, e.g. Groceries."),
    type: categoryTypeSchema.describe("INCOME for money coming in, EXPENSE for money going out."),
    description: z.string().optional().describe("Optional description."),
    color: colorSchema.optional(),
  }),
  outputSchema: categoryResultSchema,
  annotations: CREATE,
  covers: ["POST /api/v1/categories"],
  since: SINCE_2_0_0,
  async handler(input, api) {
    return { data: { category: await api.post<Category>("/categories", input) } };
  },
});

export const updateCategory = defineTool({
  name: "update_category",
  title: "Update category",
  description:
    "Changes a category's name, type, description or color; only the fields you pass change. " +
    "Changing the type moves all of the category's records between income and expense.",
  inputSchema: requireChanges(
    z.object({
      id: categoryIdSchema,
      name: nameSchema("New name.").optional(),
      type: categoryTypeSchema.optional().describe("New type: INCOME or EXPENSE."),
      description: z.string().optional().describe("New description; an empty string removes it."),
      color: colorSchema.optional(),
    }),
  ),
  outputSchema: categoryResultSchema,
  annotations: UPDATE,
  covers: ["PATCH /api/v1/categories/:id"],
  since: SINCE_2_0_0,
  async handler({ id, ...changes }, api) {
    return { data: { category: await api.patch<Category>(`/categories/${id}`, changes) } };
  },
});

export const deleteCategory = defineTool({
  name: "delete_category",
  title: "Delete category",
  description:
    "Deletes a category. Monexa refuses while any record still uses it; move those records to another category or delete them first.",
  inputSchema: z.object({ id: categoryIdSchema }),
  outputSchema: deletedSchema,
  annotations: DELETE,
  covers: ["DELETE /api/v1/categories/:id"],
  since: SINCE_2_0_0,
  async handler({ id }, api) {
    await api.delete(`/categories/${id}`);
    return deletedReply(id);
  },
});
