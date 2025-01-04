import * as React from "react"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={`flex h-9 w-full rounded-md border border-gray-300 
          bg-transparent px-3 py-1 text-sm shadow-sm 
          placeholder:text-gray-400 focus:outline-none focus:ring-1 
          focus:ring-blue-500 disabled:cursor-not-allowed 
          disabled:opacity-50 ${className}`}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }