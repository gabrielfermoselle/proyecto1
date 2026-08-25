import { useAuth } from "../hooks/useAuth.js";
import MyOrders from "./MyOrders.jsx";
import ReceivedOrders from "./ReceivedOrders.jsx";

export default function Dashboard() {
  const { user } = useAuth();
  return user.role === "plomero" ? <ReceivedOrders /> : <MyOrders />;
}
