'use client'
import React from 'react'
import { UserButton } from '@clerk/nextjs'

export default function DropdownProfile(){
  return (
    <div className="relative inline-flex items-center gap-2">
      <UserButton afterSignOutUrl="/sign-in" />
    </div>
  )
}
