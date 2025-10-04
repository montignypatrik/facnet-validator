import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import client from "@/api/client";

interface FieldCatalogItem {
  id: string;
  tableName: string;
  fieldKey: string;
  label: string;
  type: "text" | "number" | "boolean" | "date" | "select" | "multiselect";
  required: boolean;
  options?: string[];
  uniqueField: boolean;
  defaultValue?: string;
  active: boolean;
}

interface DynamicFormProps {
  tableName: string;
  initialData?: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function DynamicForm({ tableName, initialData, onSubmit, onCancel, isLoading }: DynamicFormProps) {
  const { data: fieldCatalog = [] } = useQuery({
    queryKey: [`/field-catalog?table=${tableName}`],
    queryFn: async () => {
      const response = await client.get(`/field-catalog?table=${tableName}`);
      return response.data as FieldCatalogItem[];
    },
  });

  // Get all field keys from initialData
  const getAllFieldKeys = () => {
    if (!initialData) return [];
    const excludedFields = ['id', 'createdAt', 'updatedAt', 'updatedBy', 'customFields'];
    return Object.keys(initialData).filter(key => !excludedFields.includes(key));
  };

  // Build dynamic schema
  const buildSchema = () => {
    const schemaShape: Record<string, z.ZodType> = {};

    // Add all fields from initialData dynamically
    if (initialData) {
      getAllFieldKeys().forEach(key => {
        const value = initialData[key];

        if (typeof value === 'boolean') {
          schemaShape[key] = z.boolean().optional();
        } else if (typeof value === 'number') {
          schemaShape[key] = z.union([z.string(), z.number()]).optional();
        } else {
          schemaShape[key] = z.string().optional();
        }
      });
    } else {
      // Fallback to hardcoded required fields for creation
      switch (tableName) {
        case "codes":
          schemaShape.code = z.string().min(1, "Code is required");
          schemaShape.description = z.string().min(1, "Description is required");
          schemaShape.category = z.string().optional();
          schemaShape.active = z.boolean().default(true);
          break;
        case "contexts":
          schemaShape.name = z.string().min(1, "Name is required");
          schemaShape.description = z.string().optional();
          schemaShape.tags = z.array(z.string()).optional();
          break;
        case "establishments":
          schemaShape.name = z.string().min(1, "Name is required");
          schemaShape.type = z.string().optional();
          schemaShape.region = z.string().optional();
          schemaShape.active = z.boolean().default(true);
          schemaShape.notes = z.string().optional();
          break;
        case "rules":
          schemaShape.name = z.string().min(1, "Name is required");
          schemaShape.condition = z.string().min(1, "Condition is required");
          schemaShape.threshold = z.string().optional();
          schemaShape.enabled = z.boolean().default(true);
          break;
      }
    }

    // Add custom fields from catalog
    fieldCatalog.forEach((field) => {
      let fieldSchema: z.ZodType;

      switch (field.type) {
        case "number":
          fieldSchema = z.string().refine((val) => !isNaN(Number(val)), "Must be a number");
          break;
        case "boolean":
          fieldSchema = z.boolean();
          break;
        case "select":
        case "multiselect":
          fieldSchema = field.type === "multiselect" 
            ? z.array(z.string()) 
            : z.string();
          break;
        default:
          fieldSchema = z.string();
      }

      if (field.required) {
        fieldSchema = fieldSchema.refine((val) => {
          if (Array.isArray(val)) return val.length > 0;
          return val !== "" && val !== undefined && val !== null;
        }, `${field.label} is required`);
      } else {
        fieldSchema = fieldSchema.optional();
      }

      schemaShape[`customFields.${field.fieldKey}`] = fieldSchema;
    });

    return z.object(schemaShape);
  };

  const schema = buildSchema();
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      ...initialData,
      customFields: initialData?.customFields || {},
    },
  });

  const handleSubmit = (data: any) => {
    // Separate core fields from custom fields
    const customFields: Record<string, any> = {};
    const coreFields: Record<string, any> = {};

    Object.entries(data).forEach(([key, value]) => {
      if (key.startsWith("customFields.")) {
        const fieldKey = key.replace("customFields.", "");
        customFields[fieldKey] = value;
      } else {
        coreFields[key] = value;
      }
    });

    // Handle special cases
    if (tableName === "rules" && coreFields.condition) {
      try {
        coreFields.condition = JSON.parse(coreFields.condition);
      } catch {
        // If not valid JSON, wrap it as a simple condition
        coreFields.condition = { rule: coreFields.condition };
      }
    }

    onSubmit({
      ...coreFields,
      customFields,
    });
  };

  // Format field key to readable label
  const formatLabel = (key: string) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .trim();
  };

  const renderField = (fieldKey: string, field: FieldCatalogItem | null, isCore = false) => {
    const name = isCore ? fieldKey : `customFields.${fieldKey}`;
    const value = initialData?.[fieldKey];
    const fieldType = field?.type || (typeof value === 'boolean' ? 'boolean' : 'text');

    return (
      <FormField
        key={name}
        control={form.control}
        name={name}
        render={({ field: formField }) => (
          <FormItem>
            <FormLabel>
              {field?.label || formatLabel(fieldKey)}
              {field?.required && <span className="text-red-500 ml-1">*</span>}
              {field?.uniqueField && (
                <Badge variant="outline" className="ml-2">
                  Unique
                </Badge>
              )}
            </FormLabel>
            <FormControl>
              {(() => {
                switch (fieldType) {
                  case "textarea":
                    return (
                      <Textarea
                        {...formField}
                        placeholder={field?.defaultValue}
                        data-testid={`input-${fieldKey}`}
                      />
                    );
                  case "boolean":
                    return (
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={formField.value === true || formField.value === 'true'}
                          onCheckedChange={formField.onChange}
                          data-testid={`checkbox-${fieldKey}`}
                        />
                        <span>Yes</span>
                      </div>
                    );
                  case "select":
                    return (
                      <Select
                        value={formField.value}
                        onValueChange={formField.onChange}
                      >
                        <SelectTrigger data-testid={`select-${fieldKey}`}>
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                          {field?.options?.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    );
                  case "multiselect":
                    return (
                      <div className="space-y-2">
                        {field?.options?.map((option) => (
                          <div key={option} className="flex items-center space-x-2">
                            <Checkbox
                              checked={(formField.value as string[])?.includes(option)}
                              onCheckedChange={(checked) => {
                                const current = (formField.value as string[]) || [];
                                if (checked) {
                                  formField.onChange([...current, option]);
                                } else {
                                  formField.onChange(current.filter((v) => v !== option));
                                }
                              }}
                              data-testid={`checkbox-${fieldKey}-${option}`}
                            />
                            <span>{option}</span>
                          </div>
                        ))}
                      </div>
                    );
                  case "number":
                    return (
                      <Input
                        {...formField}
                        type="number"
                        step="any"
                        placeholder={field?.defaultValue}
                        data-testid={`input-${fieldKey}`}
                      />
                    );
                  default:
                    return (
                      <Input
                        {...formField}
                        type="text"
                        placeholder={field?.defaultValue}
                        data-testid={`input-${fieldKey}`}
                        value={formField.value || ''}
                      />
                    );
                }
              })()}
            </FormControl>
            {field?.defaultValue && (
              <FormDescription>Default: {field.defaultValue}</FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* If editing (initialData exists), show ALL fields from the row */}
          {initialData ? (
            <>
              {getAllFieldKeys().map((fieldKey) =>
                renderField(fieldKey, null, true)
              )}
              {/* Custom fields */}
              {fieldCatalog.map((field) =>
                renderField(field.fieldKey, field)
              )}
            </>
          ) : (
            /* If creating new, show only required fields */
            <>
              {tableName === "codes" && (
                <>
                  {renderField("code", null, true)}
                  {renderField("description", null, true)}
                  {renderField("category", null, true)}
                  {renderField("active", { type: "boolean" } as any, true)}
                </>
              )}

              {tableName === "contexts" && (
                <>
                  {renderField("name", null, true)}
                  {renderField("description", { type: "textarea" } as any, true)}
                </>
              )}

              {tableName === "establishments" && (
                <>
                  {renderField("name", null, true)}
                  {renderField("type", null, true)}
                  {renderField("region", null, true)}
                  {renderField("active", { type: "boolean" } as any, true)}
                  {renderField("notes", { type: "textarea" } as any, true)}
                </>
              )}

              {tableName === "rules" && (
                <>
                  {renderField("name", null, true)}
                  {renderField("condition", { type: "textarea" } as any, true)}
                  {renderField("threshold", null, true)}
                  {renderField("enabled", { type: "boolean" } as any, true)}
                </>
              )}

              {/* Custom fields */}
              {fieldCatalog.map((field) =>
                renderField(field.fieldKey, field)
              )}
            </>
          )}
        </div>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} data-testid="button-submit">
            {isLoading ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
