<?php $this->load->view('templates/header'); ?>

<body>
  <div id="wrapper">

    <!-- Sidebar -->
    <?php $this->load->view('templates/sidebar'); ?>

    <!-- Page Content -->
    <div id="page-content-wrapper">
      <?php $this->load->view('templates/topbar'); ?>

      <div class="container-fluid">
        <div class="row">
          <div class="col-lg-12">
            <div class="d-flex justify-content-between align-items-center mb-4">
              <h1 class="h3 text-gray-800"><?php echo $title; ?></h1>
              <div>
                <a href="<?php echo base_url();?>providers/edit/<?php echo $provider->id; ?>" class="btn btn-warning">
                  <i class="fa fa-edit"></i> Edit Provider
                </a>
                <a href="<?php echo base_url();?>providers/analytics/<?php echo $provider->id; ?>" class="btn btn-success">
                  <i class="fa fa-chart-line"></i> Analytics
                </a>
              </div>
            </div>
            
            <?php if($this->session->flashdata('message')): ?>
            <div class="alert alert-info alert-dismissible fade show" role="alert">
              <?php echo $this->session->flashdata('message'); ?>
              <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <?php endif; ?>

            <!-- Breadcrumb -->
            <nav aria-label="breadcrumb">
              <ol class="breadcrumb">
                <li class="breadcrumb-item"><a href="<?php echo base_url();?>providers">Providers</a></li>
                <li class="breadcrumb-item active" aria-current="page"><?php echo $provider->name; ?></li>
              </ol>
            </nav>

            <!-- Provider Information -->
            <div class="row">
              <!-- Basic Information -->
              <div class="col-lg-8">
                <div class="card shadow mb-4">
                  <div class="card-header py-3">
                    <h6 class="m-0 font-weight-bold text-primary">Provider Information</h6>
                  </div>
                  <div class="card-body">
                    <div class="row">
                      <div class="col-md-6">
                        <table class="table table-borderless">
                          <tr>
                            <td><strong>Provider Name:</strong></td>
                            <td><?php echo $provider->name; ?></td>
                          </tr>
                          <tr>
                            <td><strong>Description:</strong></td>
                            <td><?php echo $provider->description ?: 'No description available'; ?></td>
                          </tr>
                          <tr>
                            <td><strong>Currency:</strong></td>
                            <td>
                              <span class="badge badge-secondary badge-lg">
                                <?php echo $provider->currency; ?>
                              </span>
                            </td>
                          </tr>
                          <tr>
                            <td><strong>Status:</strong></td>
                            <td>
                              <span class="badge badge-<?php echo ($provider->status == 'active') ? 'success' : 'secondary'; ?> badge-lg">
                                <?php echo ucfirst($provider->status); ?>
                              </span>
                            </td>
                          </tr>
                        </table>
                      </div>
                      <div class="col-md-6">
                        <table class="table table-borderless">
                          <tr>
                            <td><strong>Billing Increment:</strong></td>
                            <td><?php echo $provider->billing_increment; ?> seconds</td>
                          </tr>
                          <tr>
                            <td><strong>Minimum Duration:</strong></td>
                            <td><?php echo $provider->minimum_duration; ?> seconds</td>
                          </tr>
                          <tr>
                            <td><strong>Created:</strong></td>
                            <td><?php echo date('M j, Y \a\t g:i A', strtotime($provider->created_at)); ?></td>
                          </tr>
                          <tr>
                            <td><strong>Last Updated:</strong></td>
                            <td>
                              <?php echo $provider->updated_at ? date('M j, Y \a\t g:i A', strtotime($provider->updated_at)) : 'Never'; ?>
                            </td>
                          </tr>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Statistics -->
              <div class="col-lg-4">
                <div class="card shadow mb-4">
                  <div class="card-header py-3">
                    <h6 class="m-0 font-weight-bold text-success">Quick Stats</h6>
                  </div>
                  <div class="card-body">
                    <div class="text-center">
                      <div class="mb-3">
                        <h4 class="text-primary"><?php echo $stats->total_rate_cards ?: 0; ?></h4>
                        <small class="text-muted">Rate Cards</small>
                      </div>
                      <div class="mb-3">
                        <h4 class="text-success"><?php echo $stats->total_users ?: 0; ?></h4>
                        <small class="text-muted">Users</small>
                      </div>
                      <div class="mb-3">
                        <h4 class="text-info">$<?php echo number_format($stats->total_revenue ?: 0, 2); ?></h4>
                        <small class="text-muted">Total Revenue</small>
                      </div>
                      <div class="mb-3">
                        <h4 class="text-warning"><?php echo number_format($stats->total_calls ?: 0); ?></h4>
                        <small class="text-muted">Total Calls</small>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Performance Metrics -->
            <?php if(!empty($performance)): ?>
            <div class="card shadow mb-4">
              <div class="card-header py-3">
                <h6 class="m-0 font-weight-bold text-info">Performance Metrics (Last 30 Days)</h6>
              </div>
              <div class="card-body">
                <div class="row">
                  <div class="col-md-3">
                    <div class="card border-left-primary shadow h-100 py-2">
                      <div class="card-body">
                        <div class="row no-gutters align-items-center">
                          <div class="col mr-2">
                            <div class="text-xs font-weight-bold text-primary text-uppercase mb-1">Call Volume</div>
                            <div class="h5 mb-0 font-weight-bold text-gray-800"><?php echo number_format($performance->call_volume ?: 0); ?></div>
                          </div>
                          <div class="col-auto">
                            <i class="fas fa-phone fa-2x text-gray-300"></i>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="col-md-3">
                    <div class="card border-left-success shadow h-100 py-2">
                      <div class="card-body">
                        <div class="row no-gutters align-items-center">
                          <div class="col mr-2">
                            <div class="text-xs font-weight-bold text-success text-uppercase mb-1">Revenue</div>
                            <div class="h5 mb-0 font-weight-bold text-gray-800">$<?php echo number_format($performance->revenue ?: 0, 2); ?></div>
                          </div>
                          <div class="col-auto">
                            <i class="fas fa-dollar-sign fa-2x text-gray-300"></i>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="col-md-3">
                    <div class="card border-left-info shadow h-100 py-2">
                      <div class="card-body">
                        <div class="row no-gutters align-items-center">
                          <div class="col mr-2">
                            <div class="text-xs font-weight-bold text-info text-uppercase mb-1">Avg Duration</div>
                            <div class="h5 mb-0 font-weight-bold text-gray-800"><?php echo number_format($performance->avg_duration ?: 0); ?>s</div>
                          </div>
                          <div class="col-auto">
                            <i class="fas fa-clock fa-2x text-gray-300"></i>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="col-md-3">
                    <div class="card border-left-warning shadow h-100 py-2">
                      <div class="card-body">
                        <div class="row no-gutters align-items-center">
                          <div class="col mr-2">
                            <div class="text-xs font-weight-bold text-warning text-uppercase mb-1">Success Rate</div>
                            <div class="h5 mb-0 font-weight-bold text-gray-800"><?php echo number_format($performance->success_rate ?: 0, 1); ?>%</div>
                          </div>
                          <div class="col-auto">
                            <i class="fas fa-percentage fa-2x text-gray-300"></i>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <?php endif; ?>

            <!-- Top Destinations -->
            <?php if(!empty($top_destinations)): ?>
            <div class="card shadow mb-4">
              <div class="card-header py-3">
                <h6 class="m-0 font-weight-bold text-warning">Top Destinations</h6>
              </div>
              <div class="card-body">
                <div class="table-responsive">
                  <table class="table table-bordered" width="100%" cellspacing="0">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Destination</th>
                        <th>Code</th>
                        <th>Calls</th>
                        <th>Revenue</th>
                        <th>Avg Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      <?php foreach($top_destinations as $index => $dest): ?>
                      <tr>
                        <td><?php echo $index + 1; ?></td>
                        <td><?php echo $dest->destination_name; ?></td>
                        <td><span class="badge badge-secondary"><?php echo $dest->destination_code; ?></span></td>
                        <td><?php echo number_format($dest->call_count); ?></td>
                        <td>$<?php echo number_format($dest->revenue, 4); ?></td>
                        <td>$<?php echo number_format($dest->avg_rate, 4); ?></td>
                      </tr>
                      <?php endforeach; ?>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <?php endif; ?>

          </div>
        </div>
      </div>
      <!-- /.container-fluid -->

    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->

  <?php $this->load->view('templates/footer'); ?>

  <script>
    $(document).ready(function(){
      // Initialize tooltips
      $('[data-toggle="tooltip"]').tooltip();
    });
  </script>
</body>

</html>