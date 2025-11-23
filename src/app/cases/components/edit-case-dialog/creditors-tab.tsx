'use client';

import { useTransition } from 'react';
import { useForm, useFormContext } from 'react-hook-form';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';

import { CreditorsSection } from '../create-case-dialog/creditors-section';
import { addDebtToCase, removeDebtFromCase } from '@/features/case/actions';
import { addDebtToCaseSchema } from '@/features/case/schemas';
import type {
  CreditorOption,
  FormDebt,
  AddDebtToCaseData,
} from '@/features/case/schemas';

interface CreditorsTabProps {
  caseId: string;
  creditors: CreditorOption[];
}

export function CreditorsTab({
  caseId,
  creditors,
}: Readonly<CreditorsTabProps>) {
  const form = useFormContext();
  const newDebtForm = useForm<AddDebtToCaseData>({
    resolver: zodResolver(addDebtToCaseSchema),
    defaultValues: {
      caseId,
      creditorId: '',
      amount: '',
      type: '',
      interestRate: '',
    },
  });

  const [isPending, startTransition] = useTransition();

  const addDebt = newDebtForm.handleSubmit((data) => {
    startTransition(async () => {
      const { success, data: result, error } = await addDebtToCase(data);

      if (success && result) {
        toast.success('Deuda agregada exitosamente');
        const currentDebts = form.getValues('debts') ?? [];
        form.setValue('debts', [
          ...currentDebts,
          {
            id: result.id,
            creditor: result.creditor,
            creditorId: result.creditorId,
            amount: result.amount.toString(),
            type: result.type,
            interestRate: result.interestRate.toString(),
          },
        ]);
        newDebtForm.reset({
          caseId,
          creditorId: '',
          amount: '',
          type: '',
          interestRate: '',
        });
      } else {
        toast.error(error ?? 'Error al agregar la deuda');
      }
    });
  });

  const removeDebt = (debtId: string) => {
    startTransition(async () => {
      const {
        success,
        data: deletedDebt,
        error,
      } = await removeDebtFromCase({ debtId });

      if (success && deletedDebt) {
        toast.success('Deuda eliminada exitosamente');
        const currentDebts = form.getValues('debts') ?? [];
        form.setValue(
          'debts',
          currentDebts.filter((debt: FormDebt) => debt.id !== deletedDebt.id),
        );
      } else {
        toast.error(error ?? 'Error al eliminar la deuda');
      }
    });
  };

  return (
    <CreditorsSection
      creditors={creditors}
      newDebt={{
        creditor:
          creditors.find((c) => c.id === newDebtForm.watch('creditorId'))
            ?.name ?? '',
        creditorId: newDebtForm.watch('creditorId'),
        amount: newDebtForm.watch('amount'),
        type: newDebtForm.watch('type'),
        interestRate: newDebtForm.watch('interestRate'),
      }}
      debts={(form.watch('debts') ?? []) as FormDebt[]}
      onNewDebtChange={(debt) => {
        newDebtForm.setValue('caseId', caseId);
        newDebtForm.setValue('creditorId', debt.creditorId ?? '');
        newDebtForm.setValue('amount', debt.amount);
        newDebtForm.setValue('type', debt.type);
        newDebtForm.setValue('interestRate', debt.interestRate);
      }}
      onAddDebt={addDebt}
      onRemoveDebt={removeDebt}
      isLoading={isPending}
    />
  );
}
