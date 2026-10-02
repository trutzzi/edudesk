'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/button';
import { Field, FormError, SelectField } from '@/components/ui/Field';
import { useSend } from '@/lib/useSend';
import { INVITABLE_ROLES, type InvitableRole, type Member } from './types';

interface Props {
  classes: { id: string; name: string }[];
  students: Member[];
  // The roles this person may invite; a teacher may only invite students
  roles?: InvitableRole[];
  // Teachers must place the student in one of their classes
  requireClass?: boolean;
  onSent: (email: string) => void;
  onCancel: () => void;
}

export function InviteForm({ classes, students, roles = INVITABLE_ROLES, requireClass = false, onSent, onCancel }: Props) {
  const t = useTranslations('People');
  const tRoles = useTranslations('Roles');
  const locale = useLocale();
  const { send, pending, error } = useSend();
  const [role, setRole] = useState<InvitableRole>(roles[0]!);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { email, classId, studentId } = Object.fromEntries(new FormData(event.currentTarget));
    const result = await send('/api/invitations', {
      body: {
        email,
        role,
        // The invitation email is written in the admin's language
        locale,
        ...(role === 'student' && classId && { classId }),
        ...(role === 'parent' && studentId && { studentId }),
      },
    });
    if (result.ok) onSent(String(email));
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={t('inviteTitle')}
      className="space-y-4 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-bold">{t('inviteTitle')}</h2>
      <FormError message={error} />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Field label={t('email')} name="email" type="email" autoComplete="off" required autoFocus />
        {roles.length > 1 && (
          <SelectField
            label={t('role')}
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value as InvitableRole)}
          >
            {roles.map((value) => (
              <option key={value} value={value}>
                {tRoles(value)}
              </option>
            ))}
          </SelectField>
        )}

        {/* What else the invitation can set up depends on the role */}
        {role === 'student' && (
          <SelectField
            label={requireClass ? t('classRequired') : t('class')}
            name="classId"
            defaultValue=""
            required={requireClass}
          >
            <option value="" disabled={requireClass}>
              {requireClass ? t('chooseClass') : t('noClass')}
            </option>
            {classes.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </SelectField>
        )}
        {role === 'parent' && (
          <SelectField label={t('child')} name="studentId" defaultValue="">
            <option value="">{t('noChild')}</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.lastName} {student.firstName}
              </option>
            ))}
          </SelectField>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={buttonClass('ghost')}>
          {t('cancel')}
        </button>
        <button type="submit" disabled={pending} className={buttonClass()}>
          {pending ? t('sending') : t('send')}
        </button>
      </div>
    </form>
  );
}
