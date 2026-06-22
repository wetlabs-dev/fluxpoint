import { InventoryDetailWorkspace } from "@/components/inventory/InventoryDetailWorkspace";
export const dynamic = "force-dynamic";
export default async function EquipmentDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) { const [{ id }, query] = await Promise.all([params, searchParams]); return <InventoryDetailWorkspace id={id} view={query.view} equipmentOnly />; }
