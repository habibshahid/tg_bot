<?php $this->load->view('templates/header'); ?>

<body>

  <div class="d-flex" id="wrapper">

    <!-- Sidebar -->
    <?php $this->load->view('templates/navbar'); ?>
    <!-- /#sidebar-wrapper -->

    <!-- Page Content -->
	<div id="page-content-wrapper">
	
      <?php $this->load->view('templates/top_nav'); ?>

      <div class="container-fluid">
        <h3 class="mt-4">
			Providers Management 
			<div class="float-right">
				<a href="<?php echo base_url();?>providers/add" class="btn btn-success btn-sm">
					<i class="fa fa-plus"></i> Add New Provider
				</a>
			</div>
		</h3>
		<h6 class="mt-4"><?php echo $this->session->flashdata('message');?></h6>
		
		<!-- Statistics Cards -->
		<div class="row mb-4">
			<div class="col-xl-3 col-md-6">
				<div class="card bg-primary text-white mb-4">
					<div class="card-body">
						<h4><?php echo count($providers); ?></h4>
						<p>Total Providers</p>
					</div>
				</div>
			</div>
			<div class="col-xl-3 col-md-6">
				<div class="card bg-success text-white mb-4">
					<div class="card-body">
						<h4><?php echo count(array_filter($providers, function($p) { return $p->status == 'active'; })); ?></h4>
						<p>Active Providers</p>
					</div>
				</div>
			</div>
			<div class="col-xl-3 col-md-6">
				<div class="card bg-info text-white mb-4">
					<div class="card-body">
						<h4><?php echo array_sum(array_column($providers, 'total_rate_cards')); ?></h4>
						<p>Total Rate Cards</p>
					</div>
				</div>
			</div>
			<div class="col-xl-3 col-md-6">
				<div class="card bg-warning text-white mb-4">
					<div class="card-body">
						<h4><?php echo array_sum(array_column($providers, 'active_rate_cards')); ?></h4>
						<p>Active Rate Cards</p>
					</div>
				</div>
			</div>
		</div>
		
		<div class="card">
			<div class="card-header">
				<h5>Providers List</h5>
			</div>
			<div class="card-body">
				<table id="providers_table" class="table table-striped table-bordered" style="width:100%">
					<thead>
						<tr>
							<th>Provider Name</th>
							<th>Description</th>
							<th>Currency</th>
							<th>Billing Settings</th>
							<th>Rate Cards</th>
							<th>Status</th>
							<th>Created</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						<?php foreach ($providers as $provider){ ?>
						<tr>
							<td>
								<strong><?php echo $provider->name;?></strong>
							</td>
							<td>
								<?php if($provider->description): ?>
									<?php echo substr($provider->description, 0, 50) . (strlen($provider->description) > 50 ? '...' : ''); ?>
								<?php else: ?>
									<span class="text-muted">No description</span>
								<?php endif; ?>
							</td>
							<td>
								<span class="badge badge-secondary"><?php echo $provider->currency; ?></span>
							</td>
							<td>
								<small>
									<strong>Increment:</strong> <?php echo $provider->billing_increment; ?>s<br>
									<strong>Min Duration:</strong> <?php echo $provider->minimum_duration; ?>s
								</small>
							</td>
							<td>
								<span class="badge badge-<?php echo ($provider->active_rate_cards > 0) ? 'success' : 'secondary'; ?>">
									<?php echo $provider->active_rate_cards; ?>/<?php echo $provider->total_rate_cards; ?>
								</span>
								<small class="text-muted d-block">Active/Total</small>
								<?php if($provider->total_rate_cards > 0): ?>
									<br><small class="text-muted">
										<a href="<?php echo base_url(); ?>rate_cards?provider_id=<?php echo $provider->id; ?>" class="text-info">
											View Rate Cards
										</a>
									</small>
								<?php endif; ?>
							</td>
							<td>
								<span class="badge badge-<?php 
									switch($provider->status) {
										case 'active': echo 'success'; break;
										case 'inactive': echo 'secondary'; break;
										default: echo 'secondary';
									}
								?>">
									<?php echo ucfirst($provider->status);?>
								</span>
							</td>
							<td><?php echo date('Y-m-d', strtotime($provider->created_at)); ?></td>
							<td>
								<div class="btn-group" role="group">
									<a href="<?php echo base_url();?>providers/view/<?php echo $provider->id;?>" class="btn btn-info btn-sm" title="View Details">
										<i class="fa fa-eye"></i>
									</a>
									<a href="<?php echo base_url();?>providers/edit/<?php echo $provider->id;?>" class="btn btn-warning btn-sm" title="Edit Provider">
										<i class="fa fa-edit"></i>
									</a>
									<div class="btn-group" role="group">
										<button type="button" class="btn btn-primary btn-sm dropdown-toggle" data-toggle="dropdown" title="More Actions">
											<i class="fa fa-cog"></i>
										</button>
										<div class="dropdown-menu">
											<a class="dropdown-item" href="<?php echo base_url();?>providers/analytics/<?php echo $provider->id;?>">
												<i class="fa fa-chart-line"></i> Analytics
											</a>
											<?php if($provider->total_rate_cards > 0): ?>
											<a class="dropdown-item" href="<?php echo base_url();?>rate_cards?provider_id=<?php echo $provider->id;?>">
												<i class="fa fa-credit-card"></i> Manage Rate Cards
											</a>
											<?php endif; ?>
											<div class="dropdown-divider"></div>
											<a class="dropdown-item text-danger" href="<?php echo base_url();?>providers/delete/<?php echo $provider->id;?>">
												<i class="fa fa-trash"></i> Delete
											</a>
										</div>
									</div>
								</div>
							</td>
						</tr>
						<?php } ?>
					</tbody>
				</table>
			</div>
		</div>
		
		<?php if(empty($providers)): ?>
		<div class="alert alert-info mt-3">
			<h5>No providers found</h5>
			<p>No providers have been configured in the system yet.</p>
			<p>
				<a href="<?php echo base_url(); ?>providers/add" class="btn btn-primary">Create Your First Provider</a>
			</p>
		</div>
		<?php endif; ?>
		
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->

  <?php $this->load->view('templates/footer'); ?>

  <script>
	  $(document).ready(function(){
		$('#providers_table').DataTable({
			"order": [[ 6, "desc" ]], // Order by created date
			"pageLength": 25,
			"responsive": true,
			"columnDefs": [
				{ "orderable": false, "targets": 7 }, // Disable sorting on Actions column
				{ "type": "date", "targets": 6 } // Date sorting for created date
			],
			"language": {
				"search": "Search providers:",
				"lengthMenu": "Show _MENU_ providers per page",
				"info": "Showing _START_ to _END_ of _TOTAL_ providers"
			}
		});
	  });
  </script>
</body>

</html