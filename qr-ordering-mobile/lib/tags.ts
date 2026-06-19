// Solid, high-contrast colour for a tag badge shown OVER an image (top-left of
// the menu card). Falls back to a dark translucent badge for unknown tags.
export function tagBadgeClasses(tag: string): string {
  switch (tag.trim().toLowerCase()) {
    case "hot":
    case "spicy":
      return "bg-red-500 text-white";
    case "vegetarian":
    case "vegan":
      return "bg-green-600 text-white";
    case "halal":
      return "bg-emerald-600 text-white";
    case "gluten-free":
    case "gluten free":
      return "bg-indigo-500 text-white";
    case "contains nuts":
    case "nuts":
      return "bg-amber-500 text-white";
    case "new":
      return "bg-sky-500 text-white";
    case "popular":
      return "bg-orange-500 text-white";
    case "chef's":
    case "signature":
    case "recommended":
      return "bg-amber-500 text-white";
    default:
      return "bg-gray-900/80 text-white";
  }
}

// Soft colour for an attribute-tag chip (Spicy, Vegetarian, Halal, …) shown on a
// white surface (the item modal). Falls back to neutral grey for unknown tags.
export function tagChipClasses(tag: string): string {
  switch (tag.trim().toLowerCase()) {
    case "hot":
    case "spicy":
      return "bg-red-50 text-red-700";
    case "vegetarian":
    case "vegan":
      return "bg-green-50 text-green-700";
    case "halal":
      return "bg-emerald-50 text-emerald-700";
    case "gluten-free":
    case "gluten free":
      return "bg-indigo-50 text-indigo-700";
    case "contains nuts":
    case "nuts":
      return "bg-amber-50 text-amber-700";
    case "new":
      return "bg-sky-50 text-sky-700";
    case "chef's":
    case "signature":
    case "popular":
    case "recommended":
      return "bg-orange-50 text-orange-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}
