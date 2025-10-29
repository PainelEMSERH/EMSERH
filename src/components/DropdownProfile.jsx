import React from 'react'
import { UserButton } from '@clerk/clerk-react'

export default function DropdownProfile(){
  return (
    <div className="relative inline-flex items-center gap-2">
      <UserButton afterSignOutUrl="/signin" />
    </div>
  )
}
