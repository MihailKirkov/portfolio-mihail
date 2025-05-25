import React from 'react'
import { ExperienceTimeline } from '../experience-timeline'

const ExperienceSection = () => {
    return (
        <section id="experience" className="py-32">
            <div className="container">
            <div className="mb-16 flex flex-col items-center">
                <h2 className="text-5xl font-bold tracking-tighter">Work Experience</h2>
                <div className="mt-2 h-1 w-20 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500"></div>
            </div>
            <ExperienceTimeline />
            </div>
        </section>
    )
}

export default ExperienceSection