from django.core.management.base import BaseCommand
from absences.models import Absence, AbsenceType


class Command(BaseCommand):
    help = 'Automatisch alle ausstehenden Krankmeldungen genehmigen'

    def handle(self, *args, **options):
        # Hole den Krankmeldungs-Typ
        try:
            sick_leave_type = AbsenceType.objects.get(name=AbsenceType.SICK_LEAVE)
        except AbsenceType.DoesNotExist:
            self.stdout.write(self.style.ERROR('Krankmeldungs-Typ nicht gefunden'))
            return

        # Hole alle ausstehenden Krankmeldungen
        pending_sick_leaves = Absence.objects.filter(
            absence_type=sick_leave_type,
            status=Absence.PENDING
        )

        count = pending_sick_leaves.count()
        
        if count == 0:
            self.stdout.write(self.style.SUCCESS('Keine ausstehenden Krankmeldungen gefunden'))
            return

        # Genehmige alle
        for absence in pending_sick_leaves:
            absence.status = Absence.APPROVED
            absence.approved_by = absence.user  # Automatisch vom System genehmigt
            absence.save()

        self.stdout.write(
            self.style.SUCCESS(f'{count} Krankmeldung(en) erfolgreich automatisch genehmigt')
        )
