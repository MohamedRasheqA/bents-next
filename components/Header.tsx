'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ShoppingBag, MessageCircle, Home, Menu, X } from 'lucide-react'
import { SignInButton, SignUpButton, UserButton, useUser } from '@clerk/nextjs'

import { Button } from '@/components/ui/button'

interface HeaderProps {
  sessions?: any[]
  currentSessionId?: string
  onSessionSelect?: (sessionId: string) => void
  onNewSession?: () => void
}

const menuItems = [
  { href: "/", icon: Home, text: "Home" },
  { href: "/chat", icon: MessageCircle, text: "Chat" },
  { href: "/shop", icon: ShoppingBag, text: "Shop" },
]

export default function Header({ sessions, currentSessionId, onSessionSelect, onNewSession }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { isSignedIn, user } = useUser()
  const router = useRouter()

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setIsMenuOpen(false)
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 bg-black text-white p-4 shadow-md z-50">
      <div className="container mx-auto flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="text-white mr-4"
          onClick={toggleMenu}
        >
          <Menu className="h-6 w-6" />
        </Button>
        <Link href="/" className="flex items-center">
          <Image
            src="/bents-logo.jpg"
            alt="Bent's Woodworking"
            width={100}
            height={50}
            className="max-h-12 w-auto"
          />
        </Link>
        <div className="ml-auto flex items-center space-x-2">
          {isSignedIn ? (
            <UserButton afterSignOutUrl="/" />
          ) : (
            <>
              <SignInButton mode="modal">
                <Button variant="outline">Sign In</Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button>Sign Up</Button>
              </SignUpButton>
            </>
          )}
        </div>
      </div>

      {isMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50" 
          onClick={handleOverlayClick}
        >
          <div className="fixed top-0 left-0 h-full w-64 bg-white text-black transition-transform duration-300 ease-in-out transform translate-x-0">
            <div className="p-4">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 text-black"
                onClick={toggleMenu}
              >
                <X className="h-6 w-6" />
              </Button>
              <ul className="mt-8 space-y-4">
                {menuItems.map((item, index) => (
                  <li key={index}>
                    <Link
                      href={item.href}
                      className="flex items-center text-black hover:text-gray-600"
                      onClick={toggleMenu}
                    >
                      <item.icon className="mr-2 h-5 w-5" />
                      {item.text}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            {isSignedIn && user && (
              <div className="absolute bottom-0 left-0 right-0 bg-gray-100 border-t border-gray-200 p-4">
                <div className="flex items-center">
                  <UserButton afterSignOutUrl="/" />
                  <span className="ml-2 text-sm text-gray-700 truncate">
                    {user.primaryEmailAddress?.emailAddress}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}