"use client";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import React from "react";
import * as yup from "yup";

const TENTANT_SELECT_TYPES = [
    { value: "all", label: "Todos" },
    { value: "name", label: "Nome" },
];

const filterSchema = yup.object().shape({
    tipoFiltro: yup.string().oneOf(["all", "name"]).required("Tipo de filtro é obrigatório"),
    name: yup.string().when("tipoFiltro", (tipoFiltro, schema) => {
        return String(tipoFiltro) === "name"
            ? schema.required("Nome é obrigatório").min(1, "Nome deve ter pelo menos 1 caractere")
            : schema;
    }),
});

export default function Tenants() {
    const [tipoFiltro, setTipoFiltro] = React.useState<"all" | "name">("all");
    const [name, setName] = React.useState("");
    const [errors, setErrors] = React.useState<Record<string, string>>({});

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await filterSchema.validate({ tipoFiltro, name }, { abortEarly: false });
            setErrors({});
            // Handle filter submission here
            console.log("Filter applied:", { tipoFiltro, name });
        } catch (error) {
            if (error instanceof yup.ValidationError) {
                const newErrors: Record<string, string> = {};
                error.inner.forEach((err) => {
                    if (err.path) {
                        newErrors[err.path] = err.message;
                    }
                });
                setErrors(newErrors);
            }
        }
    };

    return (
        <div className="p-4">
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <Select options={TENTANT_SELECT_TYPES} label="Filtro:" value={tipoFiltro}
                            onChange={(e) => setTipoFiltro(e.target.value as "all" | "name")} />
                        {errors.tipoFiltro && <span className="text-red-500 text-sm">{errors.tipoFiltro}</span>}
                    </div>

                    {tipoFiltro === "name" && (
                        <div>
                            <Input label="Nome:" id="name" value={name} onChange={(e) => setName(e.target.value)} />
                            {errors.name && <span className="text-red-500 text-sm">{errors.name}</span>}
                        </div>
                    )}
                    <div className="mt-10 w-36">
                        <Button type="submit" buttonStyle="default" className="">
                            Filtrar
                        </Button>
                    </div>
                </div>

            </form>
        </div>
    );
}