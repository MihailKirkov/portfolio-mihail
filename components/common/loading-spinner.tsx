import { Loader2 } from 'lucide-react'
import React from 'react'

interface LoadingSpinnerProps {
    text: string
}

const LoadingSpinner = ({text } : LoadingSpinnerProps) => {
    return (
        <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            <span className="ml-3 text-sm text-white/70">{text}</span>
        </div>
    )
}

export default LoadingSpinner