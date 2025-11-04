'use client'
export default function Placeholder({ title }:{ title:string }){
  return (
    <div className="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6">
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <p>Conteúdo em desenvolvimento.</p>
    </div>
  )
}
