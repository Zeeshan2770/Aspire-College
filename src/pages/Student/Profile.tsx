import { ChangeEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Camera, Loader2 } from 'lucide-react';
import { StudentLayout } from '@/components/layout/StudentLayout';
import { Button, Card, Input, Label } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { getMyStudentRecord, MyStudentRecord } from '@/services/studentPortal';
import { updateOwnProfile, uploadAvatar, changePassword } from '@/services/profile';

export default function StudentProfile() {
  const { profile, refreshProfile } = useAuth();
  const [student, setStudent] = useState<MyStudentRecord | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => { getMyStudentRecord().then(setStudent); }, []);

  if (!profile) return null;

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file.'); return; }
    if (file.size > 3 * 1024 * 1024) { toast.error('Image must be under 3 MB.'); return; }
    setUploadingAvatar(true);
    try {
      const url = await uploadAvatar(profile!.id, file);
      await updateOwnProfile(profile!.id, { avatar_url: url });
      await refreshProfile();
      toast.success('Profile picture updated.');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to upload profile picture.');
    } finally {
      setUploadingAvatar(false);
      e.target.value = '';
    }
  }

  async function savePassword() {
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match.'); return; }
    setSavingPassword(true);
    try {
      await changePassword(newPassword);
      if (profile?.must_change_password) {
        await updateOwnProfile(profile.id, { must_change_password: false });
        await refreshProfile();
      }
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully.');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <StudentLayout>
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-ink-900 sm:text-2xl">My Profile</h1>
        <p className="text-sm text-slate-500">Your academic identity — class, section, and student ID can only be changed by a Main Super Admin.</p>
      </div>

      <Card className="mb-6 p-6">
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={student?.full_name ?? ''} className="h-24 w-24 rounded-2xl object-cover shadow-card" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-brand-600 text-3xl font-extrabold text-white shadow-card">
                {student?.full_name?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <label className="absolute -bottom-2 -right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl border-2 border-white bg-brand-600 text-white shadow-soft hover:bg-brand-700">
              {uploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={uploadingAvatar} />
            </label>
          </div>
          <p className="mt-3 text-lg font-bold text-ink-900">{student?.full_name}</p>
          <p className="text-sm text-slate-400">{student?.student_uid ?? '—'}</p>
        </div>
      </Card>

      <Card className="mb-6 p-6">
        <h3 className="mb-4 font-bold text-ink-900">Academic Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <ReadOnlyField label="Father Name" value={student?.father_name ?? '—'} />
          <ReadOnlyField label="Roll Number" value={student?.roll_number ?? '—'} />
          <ReadOnlyField label="Class" value={student?.classes?.name ?? '—'} />
          <ReadOnlyField label="Section" value={student?.sections?.name ?? '—'} />
          <ReadOnlyField label="Session" value={student?.session_label ?? '—'} />
          <ReadOnlyField label="Student ID" value={student?.student_uid ?? '—'} />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-4 font-bold text-ink-900">Change Password</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>New Password</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="min 6 characters" />
          </div>
          <div>
            <Label>Confirm New Password</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </div>
        <Button className="mt-4" variant="secondary" onClick={savePassword} disabled={savingPassword}>
          {savingPassword ? 'Updating…' : 'Update Password'}
        </Button>
      </Card>
    </StudentLayout>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex h-[42px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-600">{value}</div>
    </div>
  );
}
