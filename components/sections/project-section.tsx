"use client";
import React from "react";
import { ProjectCard } from "../project-card";
import { Button } from "../ui/button";
import { ArrowRight } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";

const ProjectSection = () => {
    const { projects, loading, error } = useProjects();

    return (
        <section id="projects" className="bg-gradient-to-b from-black to-gray-900 py-32">
            <div className="container">
                <div className="mb-16 flex flex-col items-center">
                <h2 className="text-5xl font-bold tracking-tighter">Featured Projects</h2>
                <div className="mt-2 h-1 w-20 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500" />
                </div>
                {loading && (
                <p className="text-center text-white col-span-full">Loading projects...</p>
                )}
                {error && (
                <p className="text-center text-red-500 col-span-full">{error}</p>
                )}
                {!loading && !error && (
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {projects.map((project: any, index: any) => (
                    <ProjectCard
                        key={index}
                        id={project.id}
                        title={project.title}
                        summary={project.summary}
                        description={project.description}
                        tags={project.tags}
                        image={project.image}
                        link_code={project.link_code}
                        link_preview={project.link_preview}
                    />
                    ))}
                </div>
                )}
                <div className="mt-12 flex justify-center">
                <Button variant="outline" className="group rounded-full border-white/20 px-6">
                    View All Projects
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
                </div>
            </div>
        </section>
    );
};

export default ProjectSection;
