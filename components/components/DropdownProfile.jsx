'use client'
import React from 'react'
import { UserButton, useUser } from '@clerk/clerk-react'

export default function DropdownProfile(){ 
  const { user } = useUser()
  return (
    <div className="relative inline-flex items-center gap-2">
      <div className="text-right hidden sm:block">
        <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{user?.fullName || user?.username || 'Usuário'}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">Conectado</div>
      </div>
      <UserButton afterSignOutUrl="/signin" />
    </div>
  )
}