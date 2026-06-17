"use client";

import Button from "@/components/ui/Button";
import ErrorBox from "@/components/ui/ErrorBox";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import React from "react";
import { RiFunctionAddLine, RiSearchLine } from "react-icons/ri";
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
    const [tipoFiltro, setTipoFiltro] = React.useState<"all" | "name" | null>(null);
    const [name, setName] = React.useState("");
    const [errors, setErrors] = React.useState<Record<string, string>>({});

    const handleSubmit = async () => {
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

    const buscarTodos = () => {
        setTipoFiltro("all");
        setName("");
        setErrors({});
        handleSubmit();
    }

    const buscarPorNome = (nome: string) => {
        nome = nome.trim();
        setName(nome);
        if (!nome) 
            return;
        setTipoFiltro("name");
        handleSubmit();
    }

    return (
        <>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-headline-lg text-primary tracking-tight">Contratantes</h2>
                    <p className="text-on-surface-variant text-body-md">Gerencie e monitore métricas de desempenho para todos os contratantes.</p>
                </div>
                <Button className="w-auto">
                    <span className="font-label-caps text-label-caps text-md flex items-center gap-2">
                        <span className="w-5 h-5"><RiFunctionAddLine /></span>
                        Adicionar Contratante
                    </span>
                </Button>
            </div>
            <div className="inline-flex items-center gap-4 mt-6">
                <Button
                    variant={tipoFiltro === "all" ? "default" : "outline"}
                    onClick={buscarTodos}>
                    Todos
                </Button>
                <Input
                    label="Nome do Tenant" id="name" value={name}
                    onBlur={(e) => buscarPorNome(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            buscarPorNome(name);
                        }
                    }}
                    onChange={(e) => setName(e.target.value)}
                />
                <ErrorBox message={errors.name} />

            </div>
        </>
    )

    // return (
    //     <div className="p-4">
    //         <form onSubmit={handleSubmit}>
    //             <div className="grid grid-cols-3 gap-4">
    //                 <div>
    //                     <Select
    //                         options={TENTANT_SELECT_TYPES}
    //                         label="Filtro" value={tipoFiltro}
    //                         onChange={(e) => setTipoFiltro(e.target.value as "all" | "name")}
    //                         error={errors.tipoFiltro}
    //                     />
    //                 </div>

    //                 {tipoFiltro === "name" && (
    //                     <div>
    //                         <Input 
    //                         label="Nome do Tenant" id="name" 
    //                         value={name} 
    //                         onChange={(e) => setName(e.target.value)}
    //                         error={errors.name}
    //                         />
    //                     </div>
    //                 )}
    //                 <div className="mt-10 w-36">
    //                     <Button type="submit" className="">
    //                         Filtrar
    //                     </Button>
    //                 </div>
    //             </div>

    //         </form>
    //     </div>
    // );
}