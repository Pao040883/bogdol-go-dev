import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';

import { SearchAnalyticsPage } from './search-analytics.page';

const routes: Routes = [
  {
    path: '',
    component: SearchAnalyticsPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild(routes)
  ],
  declarations: [SearchAnalyticsPage]
})
export class SearchAnalyticsPageModule {}
