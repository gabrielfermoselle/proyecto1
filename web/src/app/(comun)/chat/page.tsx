import type { Metadata } from "next";
import { SinConversacionElegida } from "@/features/chat/area";

export const metadata: Metadata = { title: "Chat" };

export default function ChatPage() {
  return <SinConversacionElegida />;
}
