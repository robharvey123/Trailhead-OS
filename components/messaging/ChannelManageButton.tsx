'use client'

import { useState } from 'react'
import ManageMembersModal, { type Member } from './ManageMembersModal'

export default function ChannelManageButton({
  conversationId,
  members,
  users,
  isAdmin,
  meId,
}: {
  conversationId: string
  members: Member[]
  users: Array<{ id: string; name: string }>
  isAdmin: boolean
  meId: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        Members · {members.length}
      </button>
      {open ? (
        <ManageMembersModal
          conversationId={conversationId}
          members={members}
          users={users}
          isAdmin={isAdmin}
          meId={meId}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}
