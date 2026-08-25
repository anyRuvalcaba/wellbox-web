export interface OptionChoice {
  id: string;
  label: string;
  extraCost: number;
}

export interface OptionGroup {
  id: string;
  label: string;
  type: "single" | "multiple";
  isRequired: boolean;
  choices: OptionChoice[];
}

export interface MenuDish {
  id: string;
  name: string;
  description: string | null;
  price: number;
  photoUrl: string | null;
  optionGroups: OptionGroup[];
}

export interface MenuDay {
  id: string;
  dayDate: string;
  dayLabel: string;
  dishes: MenuDish[];
}

export interface PublishedMenu {
  id: string;
  weekStartDate: string;
  days: MenuDay[];
}

export interface CartSelectedOption {
  groupId: string;
  groupLabel: string;
  choiceId: string;
  choiceLabel: string;
  extraCost: number;
}

export interface CartItem {
  dayDate: string;
  dayLabel: string;
  dishId: string;
  dishName: string;
  unitPrice: number;
  quantity: number;
  selectedOptions: CartSelectedOption[];
}

export interface CustomerInfo {
  name: string;
  phone: string;
  notes: string;
}

export interface OrderItemForNotification {
  dayLabel: string;
  dishName: string;
  unitPrice: number;
  quantity: number;
  options: { chosenOptionLabel: string }[];
}
