"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ProjectCard } from "../project-card";
import { Button } from "../ui/button";
import { ArrowRight } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import LoadingSpinner from "../common/loading-spinner";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useTranslations } from "next-intl";

const ProjectSection = () => {
    const t = useTranslations("projectSection");
    const { projects, loading, error } = useProjects();
    const breakpoint = useBreakpoint();
    const [showAll, setShowAll] = useState(false);

    const maxVisible = useMemo(() => {
        switch (breakpoint) {
            case "lg":
                return 6;
            case "md":
                return 4;
            default:
                return 3;
        }
    }, [breakpoint]);

    const sortedProjects = useMemo(() => {
        return [...projects].sort((a, b) => a.order - b.order);
    }, [projects]);

    const visibleProjects = showAll ? sortedProjects : sortedProjects.slice(0, maxVisible);
    const shouldShowButton = sortedProjects.length > visibleProjects.length;

    return (
        <section id="projects" className="bg-gradient-to-b from-black to-gray-900 py-32">
            <div className="container">
                <div className="mb-16 flex flex-col items-center">
                    <h2 className="text-5xl font-bold tracking-tighter">{t("title")}</h2>
                    <div className="mt-2 h-1 w-20 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500" />
                </div>

                {loading && <LoadingSpinner text={t("loading")} />}
                {error && <p className="text-center text-red-500">{error}</p>}

                {!loading && !error && (
                    <>
                        <div className="grid grid-cols-1 gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 place-items-center">
                            <AnimatePresence>
                                {visibleProjects.map((project) => (
                                    <motion.div
                                        key={project.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 20 }}
                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                    >
                                        <ProjectCard project={project} />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {shouldShowButton && (
                            <motion.div
                                className="mt-12 flex justify-center"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.5 }}
                            >
                                <Button
                                    variant="outline"
                                    className="group rounded-full border-white/20 px-6"
                                    onClick={() => setShowAll(true)}
                                >
                                    {t("viewAll")}
                                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </Button>
                            </motion.div>
                        )}
                    </>
                )}
            </div>
        </section>
    );
};

export default ProjectSection;
