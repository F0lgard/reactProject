import axios from "axios";

export const fetchDiscounts = async () => {
  const response = await axios.get("http://localhost:5000/api/discounts");
  return response.data;
};
