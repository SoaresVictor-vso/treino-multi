import Select from "@/components/ui/Select";

const TENTANT_SELECT_TYPES = [
  { value: "cnpj", label: "CNPJ" },
  { value: "name", label: "Nome" },
]

export default function Home() {
  return (
    <div className="p-4">
      <Select options={TENTANT_SELECT_TYPES} />
    </div>
  );
}