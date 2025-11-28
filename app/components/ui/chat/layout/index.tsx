'use client'

import React  from 'react'
import { DefaultHeader } from './header'




export function ChatLayout({ children }: { children: React.ReactNode }) {
 


  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
 

     
       <DefaultHeader />

      {children}

    </div>
  )
}


