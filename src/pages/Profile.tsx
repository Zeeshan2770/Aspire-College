import { ChangeEvent, useState } from 'react';
import toast from 'react-hot-toast';
import { Camera, Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button, Card, Input, Label, Badge } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { updateOwnProfile, uploadAvatar, changePassword } from '@/services/profile';

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [savingInfo, setSavingInfo] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

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

  async function saveInfo() {
    if (!fullName.trim() || !phone.trim()) {
      toast.error('Name and mobile number cannot be empty.');
      return;
    }
    setSavingInfo(true);
    try {
      await updateOwnProfile(profile!.id, { full_name: fullName.trim(), phone: phone.trim() });
      await refreshProfile();
      toast.success('Profile updated. Your name will now show everywhere in the app.');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update profile.');
    } finally {
      setSavingInfo(false);
    }
  }

  async function savePassword() {
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match.'); return; }
    setSavingPassword(true);
    try {
      await changePassword(newPassword);
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
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-ink-900">My Profile</h1>
        <p className="text-sm text-slate-500">Your name, picture, email, and mobile number as they appear across the app.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="h-28 w-28 rounded-2xl object-cover shadow-card" />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-brand-600 text-4xl font-extrabold text-white shadow-card">
                  {profile.full_name?.[0]?.toUpperCase()}
                </div>
              )}
              <label className="absolute -bottom-2 -right-2 flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border-2 border-white bg-brand-600 text-white shadow-soft transition hover:bg-brand-700">
                {uploadingAvatar ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} disabled={uploadingAvatar} />
              </label>
            </div>
            <p className="mt-4 text-lg font-bold text-ink-900">{profile.full_name}</p>
            <p className="text-sm text-slate-400">{profile.email}</p>
            <Badge tone="blue">{profile.role.replace(/_/g, ' ')}</Badge>
            <p className="mt-3 text-xs text-slate-400">Click the camera icon to change your profile picture (max 3 MB).</p>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <h3 className="mb-4 font-bold text-ink-900">Basic Information</h3>
          <div className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <p className="mt-1 text-xs text-slate-400">This name is shown in the sidebar, header, and every report you generate.</p>
            </div>
            <div>
              <Label>Email</Label>
              <Input value={profile.email} disabled className="bg-slate-50 text-slate-400" />
              <p className="mt-1 text-xs text-slate-400">Email cannot be changed here — contact your Main Super Admin.</p>
            </div>
            <div>
              <Label>Mobile Number</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03xx-xxxxxxx" />
            </div>
            <Button onClick={saveInfo} disabled={savingInfo}>{savingInfo ? 'Saving…' : 'Save Changes'}</Button>
          </div>

          <hr className="my-6 border-slate-100" />

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
      </div>
    </DashboardLayout>
  );
}
