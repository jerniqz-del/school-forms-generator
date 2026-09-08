'use client';

import { useEffect, useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  EMPTY_MANUAL_LEARNER,
  MANUAL_GRADE_OPTIONS,
  prepareManualLearner,
  validateManualClass,
  type ManualClassInput,
  type ManualLearnerDraft,
} from '@/lib/manual-learners';

export function AddClassDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: ManualClassInput) => void;
}) {
  const [gradeLevel, setGradeLevel] = useState('');
  const [section, setSection] = useState('');
  const [adviser, setAdviser] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setGradeLevel('');
      setSection('');
      setAdviser('');
      setError('');
    }
  }, [open]);

  const handleSubmit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const input = { gradeLevel, section, adviser };
    const validationError = validateManualClass(input);
    if (validationError) {
      setError(validationError);
      return;
    }
    onAdd(input);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users className="size-5" />
            </div>
            <DialogTitle>Add class without SF1</DialogTitle>
            <DialogDescription>
              Create a class list first, then add learners by name. Use this when an SF1 is missing or incomplete.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="manual-class-grade">Grade level</Label>
              <Select value={gradeLevel || undefined} onValueChange={setGradeLevel}>
                <SelectTrigger id="manual-class-grade" aria-label="Grade level">
                  <SelectValue placeholder="Select grade level" />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_GRADE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manual-class-section">Section</Label>
              <Input
                id="manual-class-section"
                value={section}
                onChange={(event) => setSection(event.target.value)}
                placeholder="e.g. HOPE"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="manual-class-adviser">Adviser (optional)</Label>
              <Input
                id="manual-class-adviser"
                value={adviser}
                onChange={(event) => setAdviser(event.target.value)}
                placeholder="e.g. Juan D. Cruz"
                autoComplete="off"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create class</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddLearnerDialog({
  open,
  onOpenChange,
  existingLrns,
  classLabel,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingLrns: string[];
  classLabel: string;
  onAdd: (learner: ManualLearnerDraft) => void;
}) {
  const [draft, setDraft] = useState<ManualLearnerDraft>(EMPTY_MANUAL_LEARNER);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setDraft(EMPTY_MANUAL_LEARNER);
      setError('');
    }
  }, [open]);

  const updateDraft = <K extends keyof ManualLearnerDraft>(field: K, value: ManualLearnerDraft[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const handleSubmit = (event: { preventDefault: () => void }, addAnother: boolean) => {
    event.preventDefault();
    const result = prepareManualLearner(draft, existingLrns);
    if (result.error || !result.learner) {
      setError(result.error || 'Could not add this learner.');
      return;
    }
    onAdd(result.learner);
    if (addAnother) {
      setDraft(EMPTY_MANUAL_LEARNER);
      setError('');
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={(event) => handleSubmit(event, false)}>
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserPlus className="size-5" />
            </div>
            <DialogTitle>Add learner</DialogTitle>
            <DialogDescription>
              Add a learner to {classLabel}. LRN is optional; a temporary ID is assigned if it is left blank.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-3">
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="manual-learner-name">Name</Label>
                <Input
                  id="manual-learner-name"
                  value={draft.Name}
                  onChange={(event) => updateDraft('Name', event.target.value)}
                  placeholder="DELA CRUZ, JUAN D."
                  autoComplete="off"
                  required
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="manual-learner-lrn">LRN (optional)</Label>
                  <Input
                    id="manual-learner-lrn"
                    value={draft.LRN}
                    onChange={(event) => updateDraft('LRN', event.target.value)}
                    placeholder="12-digit LRN"
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manual-learner-sex">Sex</Label>
                  <Select
                    value={draft.Sex || undefined}
                    onValueChange={(value) => updateDraft('Sex', value as ManualLearnerDraft['Sex'])}
                  >
                    <SelectTrigger id="manual-learner-sex" aria-label="Sex">
                      <SelectValue placeholder="Select sex" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="manual-learner-birthdate">Birthdate</Label>
                  <Input
                    id="manual-learner-birthdate"
                    value={draft.Birthdate}
                    onChange={(event) => updateDraft('Birthdate', event.target.value)}
                    placeholder="MM/DD/YYYY"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manual-learner-age">Age (optional)</Label>
                  <Input
                    id="manual-learner-age"
                    value={draft.Age === '' ? '' : String(draft.Age)}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === '') {
                        updateDraft('Age', '');
                        return;
                      }
                      const parsed = Number(value);
                      updateDraft('Age', Number.isFinite(parsed) ? parsed : '');
                    }}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="manual-learner-barangay">Barangay</Label>
                <Input
                  id="manual-learner-barangay"
                  value={draft.Barangay}
                  onChange={(event) => updateDraft('Barangay', event.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="manual-learner-municipality">Municipality</Label>
                  <Input
                    id="manual-learner-municipality"
                    value={draft.Municipality}
                    onChange={(event) => updateDraft('Municipality', event.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manual-learner-province">Province</Label>
                  <Input
                    id="manual-learner-province"
                    value={draft.Province}
                    onChange={(event) => updateDraft('Province', event.target.value)}
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="manual-learner-father">Father&apos;s name</Label>
                <Input
                  id="manual-learner-father"
                  value={draft.FatherName}
                  onChange={(event) => updateDraft('FatherName', event.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="manual-learner-mother">Mother&apos;s name</Label>
                <Input
                  id="manual-learner-mother"
                  value={draft.MotherName}
                  onChange={(event) => updateDraft('MotherName', event.target.value)}
                  autoComplete="off"
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
          </ScrollArea>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="button" variant="secondary" onClick={(event) => handleSubmit(event, true)}>
              Add another
            </Button>
            <Button type="submit">Add learner</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
