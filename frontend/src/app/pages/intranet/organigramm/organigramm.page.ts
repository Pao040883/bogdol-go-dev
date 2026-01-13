import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonButton,
  IonSelect,
  IonSelectOption,
  IonIcon,
  IonSpinner,
  ModalController,
} from '@ionic/angular/standalone';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import {
  gitNetworkOutline,
  refreshOutline,
  personOutline,
  person,
  expandOutline,
  contractOutline,
  mailOutline,
  star,
  briefcaseOutline,
  peopleOutline,
  alertCircleOutline,
  alertCircle,
} from 'ionicons/icons';
import { OrgChart } from 'd3-org-chart';

import { IntranetApiService } from '../../../services/intranet-api.service';
import { OrgChartNode, OrgChartMember, Company, Department, DepartmentMember } from '../../../models/intranet.models';
import { ToastService } from '../../../core/services/toast.service';
import { MemberDetailModalComponent } from './member-detail-modal.component';
import { OrganizationService } from '../../../core/services/organization.service';
import { MemberSpecialty } from '../../../models/organization.model';

interface D3OrgChartNode {
  id: string;
  parentId: string | null;
  name: string;
  title: string;
  department: string;
  avatar?: string;
  email?: string;
  role?: string;
  roleLevel?: number;
  isPrimary?: boolean;
  isStaffPosition?: boolean;
  isCompanyMismatch?: boolean;
  leaderName?: string;
  leaderAvatar?: string;
  leaderEmail?: string;
  specialties?: MemberSpecialty[];
  actualConnectionId?: string | null; // For custom link rendering (staff positions)
  _directSubordinates?: number;
  _totalSubordinates?: number;
}

@Component({
  selector: 'app-organigramm',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonBackButton,
    IonButton,
    IonSelect,
    IonSelectOption,
    IonIcon,
    IonSpinner,
  ],
  templateUrl: './organigramm.page.html',
  styleUrls: ['./organigramm.page.scss'],
})
export class OrganigrammPage implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('chartContainer', { static: false }) chartContainer!: ElementRef;
  
  private destroy$ = new Subject<void>();
  private chart: any;

  companies: Company[] = [];
  selectedCompanyId: number | null = null;
  departments: Department[] = [];
  members: DepartmentMember[] = [];
  memberSpecialties: MemberSpecialty[] = [];
  orgChartData: OrgChartNode[] = [];
  isLoading = false;

  constructor(
    private apiService: IntranetApiService,
    private toastService: ToastService,
    private modalController: ModalController,
    private organizationService: OrganizationService
  ) {
    addIcons({
      gitNetworkOutline,
      refreshOutline,
      personOutline,
      person,
      expandOutline,
      contractOutline,
      mailOutline,
      star,
      briefcaseOutline,
      peopleOutline,
      alertCircleOutline,
      alertCircle,
    });
  }

  ngOnInit() {
    this.loadCompanies();
  }

  loadCompanies() {
    this.apiService.getCompanies()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.companies = response.results;
          if (this.companies.length > 0) {
            this.selectedCompanyId = this.companies[0].id;
            this.onCompanyChange();
          }
        },
        error: (error) => {
          console.error('Error loading companies:', error);
          this.toastService.show('Fehler beim Laden der Gesellschaften', { color: 'danger' });
        }
      });
  }

  onCompanyChange() {
    if (this.selectedCompanyId) {
      this.loadOrgChart();
    }
  }

  ngAfterViewInit() {
    // Chart will be initialized after data is loaded
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadOrgChart() {
    if (!this.selectedCompanyId) return;
    
    this.isLoading = true;
    
    // Load departments for selected company
    this.apiService.getDepartments()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          
          // Handle both paginated and direct array responses
          const allDepartments = Array.isArray(response) ? response : (response.results || []);
          
          // Filter departments by company
          this.departments = allDepartments.filter(
            dept => dept.company === this.selectedCompanyId
          );
                   
          // Load members
          this.loadMembers();
        },
        error: (error) => {
          console.error('Error loading departments:', error);
          this.toastService.show('Fehler beim Laden der Abteilungen', { color: 'danger' });
          this.isLoading = false;
        }
      });
  }
  
  loadMembers() {
    this.apiService.getDepartmentMembers2()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.members = response.results;
          // Load member specialties
          this.loadMemberSpecialties();
        },
        error: (error) => {
          console.error('Error loading members:', error);
          this.toastService.show('Fehler beim Laden der Mitarbeiter', { color: 'danger' });
          this.isLoading = false;
        }
      });
  }

  loadMemberSpecialties() {
    this.organizationService.getMemberSpecialties().subscribe({
      next: (specialties) => {
        this.memberSpecialties = specialties;
        this.buildOrgChartData();
        this.isLoading = false;
        
        // Initialize or update the chart
        setTimeout(() => {
          this.initializeChart();
        }, 100);
      },
      error: (error) => {
        console.error('Error loading member specialties:', error);
        // Continue without specialties
        this.buildOrgChartData();
        this.isLoading = false;
        setTimeout(() => {
          this.initializeChart();
        }, 100);
      }
    });
  }
  
  buildOrgChartData() {
    // Build hierarchical data structure for D3
    const selectedCompany = this.companies.find(c => c.id === this.selectedCompanyId);
    if (!selectedCompany) return;
    
    // Create virtual root node for company
    const companyNode: OrgChartNode = {
      id: -1,
      name: selectedCompany.name,
      org_type: 'both',
      parent_id: null,
      description: selectedCompany.description || '',
      member_count: 0,
      children: [],
      members: []
    };
    
    // Build department tree
    const topLevelDepts = this.departments.filter(d => !d.parent);
    
    companyNode.children = this.buildDepartmentTree(topLevelDepts);
    
    this.orgChartData = [companyNode];
  }
  
  buildDepartmentTree(departments: Department[]): OrgChartNode[] {
    return departments.map(dept => {
      const deptMembers = this.members.filter(m => m.department === dept.id);
      const childDepts = this.departments.filter(d => d.parent === dept.id);
      
      return {
        id: dept.id,
        name: dept.name,
        org_type: 'both',
        parent_id: dept.parent || null,
        description: dept.description || '',
        member_count: deptMembers.length,
        children: this.buildDepartmentTree(childDepts),
        members: deptMembers.map(m => ({
          id: m.id,
          user_id: m.user,
          full_name: m.user_data?.full_name || '',
          email: m.user_data?.email || '',
          avatar: m.user_data?.avatar || undefined,
          role: {
            id: m.role,
            name: m.role_data?.name || '',
            code: m.role_data?.code || '',
            hierarchy_level: m.role_data?.hierarchy_level || 1,
            color: m.role_data?.color || '#000000'
          },
          position_title: m.position_title || '',
          reports_to_id: m.reports_to || null,
          is_primary: m.is_primary,
          is_active: m.is_active,
          is_staff_position: m.is_staff_position || false,
          is_company_mismatch: m.is_company_mismatch || false
        }))
      };
    });
  }

  private transformDataForD3(nodes: OrgChartNode[]): D3OrgChartNode[] {
    const result: D3OrgChartNode[] = [];
    
    // First pass: collect all members to build a map of member IDs to their department leaders
    const allMembers: Map<number, { member: OrgChartMember, deptNodeId: string, isLeader: boolean }> = new Map();
    
    const collectMembers = (node: OrgChartNode, parentId: string | null) => {
      const deptNodeId = `dept-${node.id}`;
      
      // Find department leader
      let deptLeader: OrgChartMember | null = null;
      if (node.members.length > 0) {
        const sortedMembers = [...node.members].sort((a, b) => 
          a.role.hierarchy_level - b.role.hierarchy_level
        );
        deptLeader = sortedMembers[0];
      }
      
      // Store all members with their info
      node.members.forEach(member => {
        allMembers.set(member.id, {
          member,
          deptNodeId,
          isLeader: member.id === deptLeader?.id
        });
      });
      
      // Recurse children
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => collectMembers(child, deptNodeId));
      }
    };
    
    // First pass: collect all members
    nodes.forEach(node => collectMembers(node, null));
    
    const processNode = (node: OrgChartNode, parentId: string | null, level: number = 0) => {
      // Find department leader (highest hierarchy level)
      let deptLeader: OrgChartMember | null = null;
      if (node.members.length > 0) {
        // Sort by hierarchy level (ascending = higher positions first)
        const sortedMembers = [...node.members].sort((a, b) => 
          a.role.hierarchy_level - b.role.hierarchy_level
        );
        deptLeader = sortedMembers[0]; // First member is the leader
      }
      
      // Add department as a node with leader info
      const deptNodeId = `dept-${node.id}`;
      const isDepartmentNode = node.id !== -1; // -1 is company root
      
      // Special handling: If department leader reports to someone outside the department,
      // attach the department to that person instead of the parent department
      let effectiveParentId = parentId;
      if (deptLeader && deptLeader.reports_to_id) {
        const reportsToInfo = allMembers.get(deptLeader.reports_to_id);
        if (reportsToInfo) {
          // Department leader reports to someone - attach department there
          if (reportsToInfo.isLeader) {
            // Reports to another department leader -> use that department
            effectiveParentId = reportsToInfo.deptNodeId;
          } else {
            // Reports to a regular member -> attach to that member
            effectiveParentId = `member-${deptLeader.reports_to_id}`;
          }
        }
      }
      
      result.push({
        id: deptNodeId,
        parentId: effectiveParentId,
        name: node.name,
        title: deptLeader ? (deptLeader.position_title || deptLeader.role.name) : 'Kein Abteilungsleiter',
        department: node.name,
        role: deptLeader ? deptLeader.role.name : 'Nicht besetzt',
        roleLevel: isDepartmentNode ? 0 : -1, // Use -1 for company root
        // Include leader info in department node
        leaderName: deptLeader?.full_name || undefined,
        leaderAvatar: deptLeader?.avatar || undefined,
        leaderEmail: deptLeader?.email || undefined,
        isCompanyMismatch: deptLeader?.is_company_mismatch || false,
      });
      
      // Separate staff positions from regular members
      const otherMembers = node.members.filter(m => m.id !== deptLeader?.id);
      const staffPositions = otherMembers.filter(m => m.is_staff_position);
      const regularMembers = otherMembers.filter(m => !m.is_staff_position);
      
      // Add staff positions
      staffPositions.forEach((member) => {
        const memberId = `member-${member.id}`;
        
        // CRITICAL: For staff positions to appear HORIZONTALLY next to their department,
        // they MUST have the same parent as the department (be siblings).
        // D3 OrgChart renders hierarchically - children always appear BELOW parents.
        // 
        // Level 0 (Gesellschafter): Staff positions become siblings of Gesellschafter
        // - Both have parentId = Company root
        // - Both appear on same horizontal level
        // - Custom link draws from Gesellschafter to staff position
        let staffParentId: string | null;
        let actualConnectionId: string | null = null;
               
        if (level === 1) {
          // Level 1 = Gesellschafter (direkt unter Company)
          // Stabsstellen werden SIBLINGS von Gesellschafter
          staffParentId = effectiveParentId; // Company (dept--1)
          actualConnectionId = deptNodeId; // Gesellschafter - für visuelle Verbindung
        } else {
          // Andere Ebenen: Stabsstellen als Kinder
          staffParentId = deptNodeId;
          actualConnectionId = null;
        }
        
        // Get member specialties
        const memberSpecialtiesFiltered = this.memberSpecialties.filter(
          ms => ms.member === member.id && ms.is_active
        );
        
        result.push({
          id: memberId,
          parentId: staffParentId,
          name: member.full_name,
          title: member.position_title || member.role.name,
          department: node.name,
          avatar: member.avatar || undefined,
          email: member.email,
          role: member.role.name,
          roleLevel: member.role.hierarchy_level,
          isPrimary: member.is_primary,
          isStaffPosition: true,
          isCompanyMismatch: member.is_company_mismatch,
          specialties: memberSpecialtiesFiltered,
          actualConnectionId: actualConnectionId, // For custom link rendering
        });
      });
      
      // Add regular members
      regularMembers.forEach((member) => {
        const memberId = `member-${member.id}`;
        
        // Determine parent node based on reports_to relationship
        let parentNodeId = deptNodeId;
        if (member.reports_to_id) {
          const reportsToInfo = allMembers.get(member.reports_to_id);
          if (reportsToInfo) {
            if (reportsToInfo.isLeader) {
              // Reports to a department leader -> use that department node
              parentNodeId = reportsToInfo.deptNodeId;
            } else {
              // Reports to a regular member -> use that member node
              parentNodeId = `member-${member.reports_to_id}`;
            }
          }
          // If reportsToInfo not found, default to current deptNodeId
        }
        
        // Get member specialties
        const memberSpecialtiesFiltered = this.memberSpecialties.filter(
          ms => ms.member === member.id && ms.is_active
        );
        
        result.push({
          id: memberId,
          parentId: parentNodeId,
          name: member.full_name,
          title: member.position_title || member.role.name,
          department: node.name,
          avatar: member.avatar || undefined,
          email: member.email,
          role: member.role.name,
          roleLevel: member.role.hierarchy_level,
          isPrimary: member.is_primary,
          isStaffPosition: false,
          isCompanyMismatch: member.is_company_mismatch,
          specialties: memberSpecialtiesFiltered,
        });
      });
      
      // Process children departments
      if (node.children && node.children.length > 0) {
        node.children.forEach(child => {
          processNode(child, deptNodeId, level + 1);
        });
      }
    };
    
    // Process all nodes
    nodes.forEach(node => processNode(node, null, 0));
    
    return result;
  }

  private initializeChart() {
    if (!this.chartContainer) {
      return;
    }

    const chartData = this.transformDataForD3(this.orgChartData);
    
    // Destroy existing chart to ensure clean state
    if (this.chart) {
      // Clear the container
      this.chartContainer.nativeElement.innerHTML = '';
    }
    
    // Always create a new chart instance for proper initialization
    this.chart = new OrgChart();
    
    this.chart
      .container(this.chartContainer.nativeElement)
      .data(chartData)
      .layout('top') // Top-down layout as default
      .svgHeight(window.innerHeight - 150)
      .svgWidth(window.innerWidth)
      .scaleExtent([0.1, 3]) // Min and max zoom levels
      .onZoom((transform: any) => {
        // Optional: Track zoom state
      })
      .buttonContent((node: any) => {
        // Custom expand/collapse button
        return `<div style="border-radius:5px;padding:3px;font-size:10px;margin:auto auto;background-color:#4682B4;border: 1px solid #ccc;color:white">${node.children ? `<span>▼ ${node.data._directSubordinates || ''}</span>` : ''}</div>`;
      })
      .nodeWidth((d: any) => {
        const node = d.data as D3OrgChartNode;
        // Department nodes are wider
        return node.roleLevel === 0 && node.leaderName ? 340 : 300;
      })
      .nodeHeight((d: any) => {
        const node = d.data as D3OrgChartNode;
        // Department nodes with leader are taller
        return node.roleLevel === 0 && node.leaderName ? 140 : 100;
      })
      .childrenMargin((d: any) => {
        // More space between levels
        return 80;
      })
      .compactMarginBetween((d: any) => {
        // Space between siblings
        return 50;
      })
      .compactMarginPair((d: any) => {
        // Space between node pairs
        return 40;
      })
      .neighbourMargin((d: any) => {
        // Space between neighboring branches
        const node = d.data as D3OrgChartNode;
        // Staff positions get more horizontal space
        return node.isStaffPosition ? 80 : 30;
      })
      .siblingsMargin((d: any) => {
        // Extra spacing for first-level departments (direct children of company)
        const node = d.data as D3OrgChartNode;
        const parentNode = d.parent?.data as D3OrgChartNode;
        
        // If parent is company root (-1), increase spacing
        if (parentNode && parentNode.roleLevel === -1) {
          return 100; // First level departments get more space
        }
        return 50;
      })
      .linkUpdate(function(d: any, i: any, arr: any) {
        // Customize link styling
        const link = arr[i];
        const targetNode = d.data as D3OrgChartNode;
        
        // Different line style for staff positions
        if (targetNode.isStaffPosition) {
          link.setAttribute('stroke', '#ff9800'); // Orange for staff
          link.setAttribute('stroke-width', '2');
          link.setAttribute('stroke-dasharray', '5,5'); // Dashed line
        } else {
          link.setAttribute('stroke', '#cbd5e0');
          link.setAttribute('stroke-width', '2');
        }
      })
      .nodeContent((d: any) => {
        const node = d.data as D3OrgChartNode;
        const roleColor = this.getRoleBadgeColor(node.roleLevel || 0);
        
        // Company root node (special styling)
        if (node.roleLevel === -1) {
          return `
            <div class="org-node company-node">
              <div class="company-header">
                <div class="company-name">${node.name}</div>
              </div>
            </div>
          `;
        }
        
        // Department node (with or without leader)
        if (node.roleLevel === 0) {
          // Department with leader
          if (node.leaderName) {
            const leaderAvatarHtml = node.leaderAvatar 
              ? `<img src="${node.leaderAvatar}" alt="${node.leaderName}" />`
              : `<div class="avatar-placeholder"><ion-icon name="person"></ion-icon></div>`;
            
            const companyMismatchIcon = node.isCompanyMismatch
              ? `<ion-icon color="danger" name="alert-circle" class="inactive-marker" title="Dieser Mitarbeiter ist der aktuellen Gesellschaft nicht zugeordnet"></ion-icon>`
              : '';
            
            return `
              <div class="org-node department-node ${node.isCompanyMismatch ? 'company-mismatch' : ''}">
                <div class="dept-header">
                  <div class="dept-name">${node.name}</div>
                </div>
                <div class="dept-leader">
                  <div class="leader-avatar">
                    ${leaderAvatarHtml}
                  </div>
                  <div class="leader-info">
                    <div class="leader-name">${node.leaderName} ${companyMismatchIcon}</div>
                    <div class="leader-title">${node.title}</div>
                    ${node.leaderEmail ? `
                      <div class="leader-email">
                        <ion-icon name="mail-outline"></ion-icon>
                        ${node.leaderEmail}
                      </div>
                    ` : ''}
                  </div>
                </div>
              </div>
            `;
          } else {
            // Department without leader
            return `
              <div class="org-node department-node">
                <div class="dept-header">
                  <div class="dept-name">${node.name}</div>
                </div>
                <div class="dept-leader empty-dept">
                  <div class="empty-dept-icon">
                    <ion-icon name="people-outline"></ion-icon>
                  </div>
                  <div class="leader-info">
                    <div class="leader-title">${node.title}</div>
                  </div>
                </div>
              </div>
            `;
          }
        }
        
        // Regular member node
        const memberAvatarHtml = node.avatar 
          ? `<img src="${node.avatar}" alt="${node.name}" />`
          : `<div class="avatar-placeholder"><ion-icon name="person"></ion-icon></div>`;
        
        // Build specialties HTML
        let specialtiesHtml = '';
        if (node.specialties && node.specialties.length > 0) {
          const primarySpecialty = node.specialties.find(s => s.is_primary);
          const otherSpecialties = node.specialties.filter(s => !s.is_primary);
          
          specialtiesHtml = '<div class="node-specialties">';
          
          if (primarySpecialty) {
            const proficiencyColor = this.getProficiencyColor(primarySpecialty.proficiency_level);
            specialtiesHtml += `
              <div class="specialty-badge primary-specialty" style="background-color: ${proficiencyColor}">
                <ion-icon name="star"></ion-icon>
                ${primarySpecialty.specialty_data?.code || primarySpecialty.specialty_data?.name || ''}
              </div>
            `;
          }
          
          otherSpecialties.slice(0, 3).forEach(spec => {
            const proficiencyColor = this.getProficiencyColor(spec.proficiency_level);
            specialtiesHtml += `
              <div class="specialty-badge" style="background-color: ${proficiencyColor}">
                ${spec.specialty_data?.code || spec.specialty_data?.name || ''}
              </div>
            `;
          });
          
          if (otherSpecialties.length > 3) {
            specialtiesHtml += `<div class="specialty-badge more">+${otherSpecialties.length - 3}</div>`;
          }
          
          specialtiesHtml += '</div>';
        }
        
        // Staff position marker
        const staffMarker = node.isStaffPosition 
          ? '<div class="staff-marker"><ion-icon name="briefcase-outline"></ion-icon> Stabsstelle</div>' 
          : '';
        
        // Company mismatch marker
        const companyMismatchMarker = node.isCompanyMismatch
          ? '<div class="inactive-marker"><ion-icon name="alert-circle-outline"></ion-icon> Gesellschaft nicht zugeordnet</div>'
          : '';
        
        return `
          <div class="org-node member-node ${node.isStaffPosition ? 'staff-position' : ''} ${node.isCompanyMismatch ? 'company-mismatch' : ''}">
            ${staffMarker}
            ${companyMismatchMarker}
            <div class="node-avatar">
              ${memberAvatarHtml}
              ${node.isPrimary ? '<div class="primary-badge">★</div>' : ''}
            </div>
            <div class="node-content">
              <div class="node-name">${node.name}</div>
              <div class="node-title">${node.title}</div>
              ${node.role ? `
                <div class="node-role-badge badge-${roleColor}">
                  ${node.role}
                </div>
              ` : ''}
              ${specialtiesHtml}
              ${node.email ? `
                <div class="node-email">
                  <ion-icon name="mail-outline"></ion-icon>
                  ${node.email}
                </div>
              ` : ''}
            </div>
          </div>
        `;
      })
      .onNodeClick((d: any) => {
        const nodeData = d.data as D3OrgChartNode;
        
        // Don't open modal for company root or department nodes
        if (nodeData.roleLevel === -1 || nodeData.roleLevel === 0) {
          return;
        }
        
        // Find original member data for regular member nodes
        const memberId = nodeData.id.replace('member-', '');
        const member = this.findMemberById(memberId);
        
        if (member) {
          this.openMemberDetail(member);
        } else {
          console.warn('Member not found for ID:', memberId);
        }
      })
      .compact(false) // Disable compact mode for better control
      .initialExpandLevel(2) // Expand first 2 levels by default
      .render()
      .fit();
  }

  private drawStaffConnectionLines(): void {
    // Not needed - using default D3 links
  }

  private findMemberById(memberId: string): OrgChartMember | null {
    const id = parseInt(memberId, 10);
    
    const searchNode = (node: OrgChartNode): OrgChartMember | null => {
      const found = node.members.find(m => m.id === id);
      if (found) return found;
      
      if (node.children) {
        for (const child of node.children) {
          const result = searchNode(child);
          if (result) return result;
        }
      }
      
      return null;
    };
    
    for (const node of this.orgChartData) {
      const result = searchNode(node);
      if (result) return result;
    }
    
    return null;
  }

  expandAll() {
    if (this.chart) {
      this.chart.expandAll();
    }
  }

  collapseAll() {
    if (this.chart) {
      this.chart.collapseAll();
    }
  }

  fitChart() {
    if (this.chart) {
      this.chart.fit();
    }
  }

  getRoleBadgeColor(level: number): string {
    switch (level) {
      case 1:
        return 'danger'; // Top level (Geschäftsleitung)
      case 2:
        return 'warning'; // Second level (Abteilungsleitung)
      case 3:
        return 'primary'; // Third level (Gruppenleitung)
      case 4:
        return 'success'; // Fourth level (Teamleitung)
      default:
        return 'medium'; // Other roles or departments
    }
  }

  getProficiencyColor(level: number): string {
    switch (level) {
      case 4: return '#10dc60'; // Expert - success green
      case 3: return '#5260ff'; // Advanced - primary blue
      case 2: return '#3880ff'; // Intermediate - medium blue
      case 1: return '#92949c'; // Basic - medium gray
      default: return '#92949c';
    }
  }

  async openMemberDetail(member: OrgChartMember) {
    const modal = await this.modalController.create({
      component: MemberDetailModalComponent,
      componentProps: {
        member: member
      }
    });

    await modal.present();
  }

  refresh() {
    this.loadOrgChart();
  }
}
