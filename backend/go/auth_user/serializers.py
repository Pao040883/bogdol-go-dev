# accounts/serializers.py
from rest_framework import serializers
from .models import CustomUser
from .profile_models import Department, DepartmentRole, Company, HRAssignment
from auth_user.profile_models import Specialty
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from absences.models import Absence
from django.utils.timezone import now

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = CustomUser
        fields = ['username', 'email', 'password', 'phone_number']

    def create(self, validated_data):
        return CustomUser.objects.create_user(**validated_data)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        
        # Prevent login for inactive users
        if not self.user.is_active:
            from rest_framework.exceptions import AuthenticationFailed
            raise AuthenticationFailed('Dieser Benutzer wurde deaktiviert.')
        
        data.update({
            'username': self.user.username,
            'email': getattr(self.user, 'email', None),
            'phone_number': getattr(self.user, 'phone_number', None),
        })
        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['is_superuser'] = bool(user.is_superuser)
        token['is_staff'] = bool(getattr(user, 'is_staff', False))
        
        # ❗ NEU: Groups für Permission-Checks im Frontend
        token['groups'] = list(user.groups.values_list('name', flat=True))
        
        # ❗ NEU: Department-Rollen mit Hierarchie
        department_roles = []
        for member in user.department_memberships.filter(is_active=True).select_related('department', 'role'):
            department_roles.append({
                'department_id': member.department.id,
                'department_code': member.department.code,
                'role_id': member.role.id,
                'role_code': member.role.code,
                'hierarchy_level': member.role.hierarchy_level,
                'is_primary': member.is_primary,
            })
        token['department_roles'] = department_roles
        
        # ❗ NEU: Bereiche (für schnelleren Zugriff)
        token['is_bereichsleiter'] = user.department_memberships.filter(
            is_active=True,
            role__code='BL'
        ).exists()
        
        token['is_abteilungsleiter'] = user.department_memberships.filter(
            is_active=True,
            role__code='AL'
        ).exists()
        
        return token

class UserAdminSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False)
    is_supervisor = serializers.ReadOnlyField()
    
    # Profile-Felder (werden via to_representation/update aus UserProfile gelesen/geschrieben)
    vacation_entitlement = serializers.IntegerField(required=False)
    carryover_vacation = serializers.IntegerField(required=False)
    vacation_year = serializers.IntegerField(required=False)
    responsibilities = serializers.CharField(required=False, allow_blank=True)
    expertise_areas = serializers.CharField(required=False, allow_blank=True)
    job_title = serializers.CharField(required=False, allow_blank=True)
    phone_number = serializers.CharField(required=False, allow_blank=True)
    mobile_number = serializers.CharField(required=False, allow_blank=True)
    supervisor = serializers.PrimaryKeyRelatedField(
        queryset=CustomUser.objects.all(),
        required=False,
        allow_null=True
    )
    companies = serializers.PrimaryKeyRelatedField(
        queryset=Company.objects.all(),
        many=True,
        required=False
    )

    class Meta:
        model = CustomUser
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'companies',
            'job_title',
            'responsibilities',
            'expertise_areas',
            'phone_number',
            'mobile_number',
            'is_active',
            'is_staff',
            'is_supervisor',
            'supervisor',
            'password',
            'vacation_entitlement',
            'carryover_vacation',
            'vacation_year'
        ]
        read_only_fields = ['id']
    
    def to_representation(self, instance):
        """Read companies, contact info from profile"""
        ret = super().to_representation(instance)
        if hasattr(instance, 'profile') and instance.profile:
            ret['job_title'] = instance.profile.job_title or ''
            ret['responsibilities'] = instance.profile.responsibilities or ''
            ret['expertise_areas'] = instance.profile.expertise_areas or ''
            ret['phone_number'] = instance.profile.phone_number or ''
            ret['mobile_number'] = instance.profile.mobile_number or ''
            ret['vacation_entitlement'] = instance.profile.vacation_entitlement
            ret['carryover_vacation'] = instance.profile.carryover_vacation
            ret['vacation_year'] = instance.profile.vacation_year
            # Supervisor
            direct_supervisor = instance.profile.direct_supervisor
            ret['supervisor'] = direct_supervisor.id if direct_supervisor else None
            # Companies (ManyToMany)
            ret['companies'] = list(instance.profile.companies.values_list('id', flat=True))
        return ret

    def create(self, validated_data):
        # Extract profile fields
        password = validated_data.pop('password', None)
        companies = validated_data.pop('companies', [])
        supervisor = validated_data.pop('supervisor', None)
        job_title = validated_data.pop('job_title', None)
        responsibilities = validated_data.pop('responsibilities', None)
        expertise_areas = validated_data.pop('expertise_areas', None)
        phone_number = validated_data.pop('phone_number', None)
        mobile_number = validated_data.pop('mobile_number', None)
        vacation_entitlement = validated_data.pop('vacation_entitlement', 30)
        carryover_vacation = validated_data.pop('carryover_vacation', 0)
        vacation_year = validated_data.pop('vacation_year', 2025)
        
        # Create user
        user = CustomUser(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        
        # Update or create profile
        from .profile_models import UserProfile
        profile, created = UserProfile.objects.get_or_create(user=user)
        # Don't set deprecated fields - use DepartmentMember instead
        profile.job_title = job_title or ''
        profile.responsibilities = responsibilities or ''
        profile.expertise_areas = expertise_areas or ''
        profile.phone_number = phone_number or ''
        profile.mobile_number = mobile_number or ''
        profile.direct_supervisor = supervisor
        profile.vacation_entitlement = vacation_entitlement
        profile.carryover_vacation = carryover_vacation
        profile.vacation_year = vacation_year
        profile.save()
        
        # Set companies (ManyToMany)
        if companies:
            profile.companies.set(companies)
        
        # NOTE: DepartmentMember assignments are NOT created here!
        # Users can have MULTIPLE department memberships across different companies.
        # Use the DepartmentMember API endpoints to manage these assignments:
        # - POST /api/department-members/ to create
        # - PUT/DELETE /api/department-members/{id}/ to update/remove
        # The old single department+role fields are deprecated.
        
        # Reload user with profile to ensure to_representation has access to it
        user.refresh_from_db()
        
        return user

    def update(self, instance, validated_data):
        # Extract profile fields
        password = validated_data.pop('password', None)
        companies = validated_data.pop('companies', None)
        supervisor = validated_data.pop('supervisor', None)
        job_title = validated_data.pop('job_title', None)
        responsibilities = validated_data.pop('responsibilities', None)
        expertise_areas = validated_data.pop('expertise_areas', None)
        phone_number = validated_data.pop('phone_number', None)
        mobile_number = validated_data.pop('mobile_number', None)
        vacation_entitlement = validated_data.pop('vacation_entitlement', None)
        carryover_vacation = validated_data.pop('carryover_vacation', None)
        vacation_year = validated_data.pop('vacation_year', None)
        
        # Update user fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        
        # Update profile
        from .profile_models import UserProfile
        profile, created = UserProfile.objects.get_or_create(user=instance)
        # Don't update deprecated department/role fields
        if job_title is not None:
            profile.job_title = job_title
        if responsibilities is not None:
            profile.responsibilities = responsibilities
        if expertise_areas is not None:
            profile.expertise_areas = expertise_areas
        if phone_number is not None:
            profile.phone_number = phone_number
        if mobile_number is not None:
            profile.mobile_number = mobile_number
        # Supervisor: Allow setting to null
        if 'supervisor' in self.initial_data:
            profile.direct_supervisor = supervisor
        if vacation_entitlement is not None:
            profile.vacation_entitlement = vacation_entitlement
        if carryover_vacation is not None:
            profile.carryover_vacation = carryover_vacation
        if vacation_year is not None:
            profile.vacation_year = vacation_year
        profile.save()
        
        # Update companies (ManyToMany)
        if companies is not None:
            profile.companies.set(companies)
        
        # NOTE: DepartmentMember assignments are NOT updated here!
        # Users can have MULTIPLE department memberships (e.g., Abteilungsleiter in Gesellschaft A,
        # Mitarbeiter in Gesellschaft B, multiple departments within one company, etc.)
        # Use the DepartmentMember API endpoints to manage these complex assignments:
        # - POST /api/department-members/ to create new assignment
        # - PUT /api/department-members/{id}/ to update existing assignment  
        # - DELETE /api/department-members/{id}/ to remove assignment
        # The old single department+role fields are deprecated and should not be used.
        
        return instance


class RepresentativeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'first_name', 'last_name']

class UserPhonebookSerializer(serializers.ModelSerializer):
    is_absent = serializers.SerializerMethodField()
    absence_reason = serializers.SerializerMethodField()
    absence_end_date = serializers.SerializerMethodField()
    representative = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    job_title = serializers.SerializerMethodField()
    phone_number = serializers.SerializerMethodField()
    mobile_number = serializers.SerializerMethodField()
    companies = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'companies',
            'department',
            'job_title',
            'phone_number',
            'mobile_number',
            'is_absent',
            'absence_reason',
            'absence_end_date',
            'representative'
        ]
        read_only_fields = ['id']
    
    def get_companies(self, obj):
        """Get all companies from profile (ManyToMany)"""
        if hasattr(obj, 'profile') and obj.profile:
            return [company.name for company in obj.profile.companies.all()]
        return []
    
    def get_department(self, obj):
        """Get primary department from profile"""
        if hasattr(obj, 'profile') and obj.profile:
            primary_dept = obj.profile.primary_department
            if primary_dept:
                return primary_dept.name
        return None
    
    def get_job_title(self, obj):
        if hasattr(obj, 'profile'):
            return obj.profile.job_title
        return None
    
    def get_phone_number(self, obj):
        if hasattr(obj, 'profile'):
            return obj.profile.phone_number
        return None
    
    def get_mobile_number(self, obj):
        """Get mobile number from profile"""
        if hasattr(obj, 'profile'):
            return obj.profile.mobile_number
        return None

    def get_is_absent(self, obj):
        """Prüft ob User aktuell abwesend ist (mit neuem Status-System)"""
        today = now().date()
        return obj.absences.filter(
            start_date__lte=today,
            end_date__gte=today,
            status__in=['approved', 'hr_processed']  # ✅ FIX: Neues Status-System
        ).exists()

    def get_absence_reason(self, obj):
        """Gibt den Abwesenheitstyp zurück (z.B. 'Urlaub', 'Krankmeldung')"""
        today = now().date()
        absence = obj.absences.filter(
            start_date__lte=today,
            end_date__gte=today,
            status__in=['approved', 'hr_processed']  # ✅ FIX: Neues Status-System
        ).select_related('absence_type').first()
        
        if absence and absence.absence_type:
            return absence.absence_type.display_name  # ✅ FIX: Display Name statt reason
        return None

    def get_absence_end_date(self, obj):
        """Gibt das End-Datum der aktuellen Abwesenheit zurück"""
        today = now().date()
        absence = obj.absences.filter(
            start_date__lte=today,
            end_date__gte=today,
            status__in=['approved', 'hr_processed']
        ).first()
        
        if absence:
            return absence.end_date.isoformat()
        return None

    def get_representative(self, obj):
        """Gibt die Vertretung zurück (falls aktuell abwesend)"""
        today = now().date()
        absence = obj.absences.filter(
            start_date__lte=today,
            end_date__gte=today,
            status__in=['approved', 'hr_processed']  # ✅ FIX: Neues Status-System
        ).select_related('representative').first()
        
        if absence and absence.representative:
            return RepresentativeSerializer(absence.representative).data
        return None