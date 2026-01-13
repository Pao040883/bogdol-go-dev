import { Injectable } from '@angular/core';

export interface ChartTheme {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  background: string;
  text: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChartService {
  private defaultTheme: ChartTheme = {
    primary: '#3dc2ff',
    secondary: '#5260ff',
    success: '#10dc60',
    warning: '#ffce00',
    danger: '#f04141',
    info: '#0cd1e8',
    background: 'rgba(255, 255, 255, 0.8)',
    text: '#000000'
  };

  private darkTheme: ChartTheme = {
    primary: '#428cff',
    secondary: '#6a7ce8',
    success: '#2dd55b',
    warning: '#ffc409',
    danger: '#eb445a',
    info: '#69d7e2',
    background: 'rgba(0, 0, 0, 0.8)',
    text: '#ffffff'
  };

  constructor() {
    // Chart configuration will be handled by components
  }

  /**
   * Create performance bar chart configuration
   */
  createPerformanceChart(managers: any[]): any {
    const theme = this.getCurrentTheme();
    const limitedManagers = managers.slice(0, 10);

    return {
      type: 'bar',
      data: {
        labels: limitedManagers.map(m => m.fullName),
        datasets: [{
          label: 'Export Percentage',
          data: limitedManagers.map(m => m.statistics.exportPercentage),
          backgroundColor: limitedManagers.map(m => 
            m.statistics.exportPercentage >= 80 ? theme.success :
            m.statistics.exportPercentage >= 60 ? theme.warning : theme.danger
          ),
          borderColor: limitedManagers.map(m => 
            m.statistics.exportPercentage >= 80 ? theme.success :
            m.statistics.exportPercentage >= 60 ? theme.warning : theme.danger
          ),
          borderWidth: 2,
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Top 10 Service Manager Performance',
            font: { size: 16, weight: 'bold' },
            color: theme.text
          },
          tooltip: {
            backgroundColor: theme.background,
            titleColor: theme.text,
            bodyColor: theme.text,
            borderColor: theme.primary,
            borderWidth: 1,
            callbacks: {
              label: (context: any) => `Export-Rate: ${context.parsed.y.toFixed(1)}%`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              maxRotation: 45,
              color: theme.text
            }
          },
          y: {
            beginAtZero: true,
            max: 100,
            grid: { color: 'rgba(128, 128, 128, 0.1)' },
            ticks: {
              callback: (value: any) => `${value}%`,
              color: theme.text
            }
          }
        },
        animation: {
          duration: 1000,
          easing: 'easeInOutQuart'
        }
      }
    };
  }

  /**
   * Create area performance doughnut chart configuration
   */
  createAreaChart(performanceByArea: Record<string, number>): any {
    const theme = this.getCurrentTheme();
    const areas = Object.entries(performanceByArea);

    return {
      type: 'doughnut',
      data: {
        labels: areas.map(([area]) => area),
        datasets: [{
          label: 'Performance by Area',
          data: areas.map(([, percentage]) => percentage),
          backgroundColor: [
            theme.primary, theme.success, theme.warning, theme.danger, 
            theme.secondary, theme.info, '#9f44d3', '#f093fb', '#ff6b6b', '#4ecdc4'
          ],
          borderColor: theme.background,
          borderWidth: 3,
          hoverBorderWidth: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { 
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true,
              font: { size: 12 },
              color: theme.text
            }
          },
          title: {
            display: true,
            text: 'Performance nach Bereichen',
            font: { size: 16, weight: 'bold' },
            color: theme.text
          },
          tooltip: {
            backgroundColor: theme.background,
            titleColor: theme.text,
            bodyColor: theme.text,
            borderColor: theme.primary,
            borderWidth: 1,
            callbacks: {
              label: (context: any) => {
                const label = context.label || '';
                const value = context.parsed;
                return `${label}: ${value.toFixed(1)}%`;
              }
            }
          }
        },
        animation: {
          duration: 1500,
          easing: 'easeInOutBounce'
        }
      }
    };
  }

  /**
   * Create status distribution pie chart configuration
   */
  createStatusChart(statusCounts: Record<string, number>, translateFn: (status: string) => string): any {
    const theme = this.getCurrentTheme();
    const statuses = Object.entries(statusCounts);

    return {
      type: 'pie',
      data: {
        labels: statuses.map(([status]) => translateFn(status)),
        datasets: [{
          label: 'Worklog Status Distribution',
          data: statuses.map(([, count]) => count),
          backgroundColor: [
            theme.danger,   // New
            theme.warning,  // Exported
            theme.success,  // Approved
            theme.primary   // Billed
          ],
          borderColor: theme.background,
          borderWidth: 3,
          hoverBorderWidth: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { 
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true,
              font: { size: 12 },
              color: theme.text
            }
          },
          title: {
            display: true,
            text: 'Worklog Status Verteilung',
            font: { size: 16, weight: 'bold' },
            color: theme.text
          },
          tooltip: {
            backgroundColor: theme.background,
            titleColor: theme.text,
            bodyColor: theme.text,
            borderColor: theme.primary,
            borderWidth: 1,
            callbacks: {
              label: (context: any) => {
                const label = context.label || '';
                const value = context.parsed;
                const total = statuses.reduce((sum, [, count]) => sum + count, 0);
                const percentage = total > 0 ? (value / total * 100).toFixed(1) : '0';
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        },
        animation: {
          duration: 1500,
          easing: 'easeInOutBounce'
        }
      }
    };
  }

  /**
   * Get current theme based on system preference
   */
  private getCurrentTheme(): ChartTheme {
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark ? this.darkTheme : this.defaultTheme;
  }

  /**
   * Create location-based chart configuration
   */
  createLocationChart(locationData: any[]): any {
    const theme = this.getCurrentTheme();
    const limitedLocations = locationData.slice(0, 10);

    return {
      type: 'bar',
      data: {
        labels: limitedLocations.map(location => location.name),
        datasets: [{
          label: 'Arbeitszeit (Stunden)',
          data: limitedLocations.map(location => Number((location.minutes / 60).toFixed(1))),
          backgroundColor: theme.info,
          borderColor: theme.primary,
          borderWidth: 2,
          hoverBackgroundColor: theme.primary,
          hoverBorderColor: theme.secondary,
          hoverBorderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: { 
            display: false
          },
          title: {
            display: true,
            text: 'Arbeitszeit nach Standorten',
            font: { size: 16, weight: 'bold' },
            color: theme.text
          },
          tooltip: {
            backgroundColor: theme.background,
            titleColor: theme.text,
            bodyColor: theme.text,
            borderColor: theme.primary,
            borderWidth: 1,
            callbacks: {
              label: (context: any) => {
                const value = context.parsed.x;
                const location = limitedLocations[context.dataIndex];
                return [
                  `Stunden: ${value}`,
                  `Worklogs: ${location.worklogs}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: `${theme.text}20` },
            ticks: { color: theme.text },
            title: {
              display: true,
              text: 'Stunden',
              color: theme.text,
              font: { size: 14, weight: 'bold' }
            }
          },
          y: {
            grid: { color: `${theme.text}20` },
            ticks: { 
              color: theme.text,
              font: { size: 12 }
            }
          }
        },
        animation: {
          duration: 1500,
          easing: 'easeInOutBounce'
        }
      }
    };
  }

  /**
   * Destroy chart safely
   */
  destroyChart(chart: any): void {
    if (chart && typeof chart.destroy === 'function') {
      chart.destroy();
    }
  }
}
