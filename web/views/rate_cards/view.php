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
			Rate Card Details - <?php echo $rate_card->name; ?>
			<div class="float-right">
				<a href="<?php echo base_url();?>rate_cards/edit/<?php echo $rate_card->id;?>" class="btn btn-warning btn-sm">
					<i class="fa fa-edit"></i> Edit
				</a>
				<a href="<?php echo base_url();?>rate_cards/clone_rate_card/<?php echo $rate_card->id;?>" class="btn btn-info btn-sm">
					<i class="fa fa-copy"></i> Clone
				</a>
			</div>
		</h3>
		<nav aria-label="breadcrumb">
			<ol class="breadcrumb">
				<li class="breadcrumb-item"><a href="<?php echo base_url(); ?>rate_cards">Rate Cards</a></li>
				<li class="breadcrumb-item active"><?php echo $rate_card->name; ?></li>
			</ol>
		</nav>
		<h6 class="mt-4"><?php echo $this->session->flashdata('message');?></h6>
		
		<!-- Rate Card Information -->
		<div class="row mb-4">
			<div class="col-md-8">
				<div class="card">
					<div class="card-header">
						<h5>Rate Card Information</h5>
					</div>
					<div class="card-body">
						<div class="row">
							<div class="col-md-6">
								<table class="table table-borderless">
									<tr>
										<td><strong>Name:</strong></td>
										<td><?php echo $rate_card->name; ?></td>
									</tr>
									<tr>
										<td><strong>Provider:</strong></td>
										<td>
											<?php if($rate_card->provider_name): ?>
												<span class="badge badge-secondary"><?php echo $rate_card->provider_name; ?></span>
											<?php else: ?>
												<span class="text-muted">No Provider</span>
											<?php endif; ?>
										</td>
									</tr>
									<tr>
										<td><strong>Currency:</strong></td>
										<td><span class="badge badge-info"><?php echo $rate_card->currency; ?></span></td>
									</tr>
									<tr>
										<td><strong>Status:</strong></td>
										<td>
											<span class="badge badge-<?php 
												switch($rate_card->status) {
													case 'active': echo 'success'; break;
													case 'inactive': echo 'secondary'; break;
													case 'draft': echo 'warning'; break;
													default: echo 'secondary';
												}
											?>">
												<?php echo ucfirst($rate_card->status);?>
											</span>
										</td>
									</tr>
								</table>
							</div>
							<div class="col-md-6">
								<table class="table table-borderless">
									<tr>
										<td><strong>Effective Date:</strong></td>
										<td><?php echo date('Y-m-d', strtotime($rate_card->effective_from)); ?></td>
									</tr>
									<tr>
										<td><strong>Expiry Date:</strong></td>
										<td>
											<?php if($rate_card->effective_to): ?>
												<?php echo date('Y-m-d', strtotime($rate_card->effective_to)); ?>
											<?php else: ?>
												<span class="text-muted">Never expires</span>
											<?php endif; ?>
										</td>
									</tr>
									<tr>
										<td><strong>Created:</strong></td>
										<td><?php echo date('Y-m-d H:i:s', strtotime($rate_card->created_at)); ?></td>
									</tr>
									<tr>
										<td><strong>Last Updated:</strong></td>
										<td><?php echo date('Y-m-d H:i:s', strtotime($rate_card->updated_at)); ?></td>
									</tr>
								</table>
							</div>
						</div>
						
						<?php if($rate_card->description): ?>
						<div class="row mt-3">
							<div class="col-md-12">
								<strong>Description:</strong>
								<p class="text-muted"><?php echo $rate_card->description; ?></p>
							</div>
						</div>
						<?php endif; ?>
						
						<?php if($rate_card->provider_description): ?>
						<div class="row">
							<div class="col-md-12">
								<strong>Provider Information:</strong>
								<p class="text-muted"><?php echo $rate_card->provider_description; ?></p>
							</div>
						</div>
						<?php endif; ?>
					</div>
				</div>
			</div>
			
			<!-- Statistics Panel -->
			<div class="col-md-4">
				<div class="card">
					<div class="card-header">
						<h5>Statistics</h5>
					</div>
					<div class="card-body">
						<div class="row">
							<div class="col-md-12 mb-3">
								<div class="card bg-primary text-white">
									<div class="card-body text-center">
										<h4><?php echo number_format($stats['total_rates']); ?></h4>
										<p>Total Rates</p>
									</div>
								</div>
							</div>
							<div class="col-md-12 mb-3">
								<div class="card bg-success text-white">
									<div class="card-body text-center">
										<h4><?php echo number_format($stats['assigned_users']); ?></h4>
										<p>Assigned Users</p>
									</div>
								</div>
							</div>
							<div class="col-md-12 mb-3">
								<div class="card bg-info text-white">
									<div class="card-body text-center">
										<h4>$<?php echo number_format($stats['average_rate'], 4); ?></h4>
										<p>Average Rate</p>
									</div>
								</div>
							</div>
						</div>
						
						<?php if($stats['total_rates'] > 0): ?>
						<hr>
						<table class="table table-sm">
							<tr>
								<td>Min Rate:</td>
								<td><strong>$<?php echo number_format($stats['min_rate'], 4); ?></strong></td>
							</tr>
							<tr>
								<td>Max Rate:</td>
								<td><strong>$<?php echo number_format($stats['max_rate'], 4); ?></strong></td>
							</tr>
							<tr>
								<td>Total Calls:</td>
								<td><strong><?php echo number_format($stats['total_calls']); ?></strong></td>
							</tr>
							<tr>
								<td>Total Revenue:</td>
								<td><strong>$<?php echo number_format($stats['total_revenue'], 2); ?></strong></td>
							</tr>
						</table>
						<?php endif; ?>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Quick Actions -->
		<div class="row mb-4">
			<div class="col-md-12">
				<div class="card">
					<div class="card-header">
						<h5>Quick Actions</h5>
					</div>
					<div class="card-body">
						<div class="row">
							<div class="col-md-3">
								<a href="<?php echo base_url(); ?>rates/add?rate_card_id=<?php echo $rate_card->id; ?>" class="btn btn-success btn-block">
									<i class="fa fa-plus"></i> Add Rate
								</a>
							</div>
							<div class="col-md-3">
								<a href="<?php echo base_url(); ?>rates/bulk_upload?rate_card_id=<?php echo $rate_card->id; ?>" class="btn btn-primary btn-block">
									<i class="fa fa-upload"></i> Bulk Upload
								</a>
							</div>
							<?php if($stats['total_rates'] > 0): ?>
							<div class="col-md-3">
								<a href="<?php echo base_url(); ?>rates/export_rates?rate_card_id=<?php echo $rate_card->id; ?>" class="btn btn-info btn-block">
									<i class="fa fa-download"></i> Export Rates
								</a>
							</div>
							<div class="col-md-3">
								<a href="<?php echo base_url(); ?>rate_cards/bulk_update_rates/<?php echo $rate_card->id; ?>" class="btn btn-warning btn-block">
									<i class="fa fa-edit"></i> Bulk Update
								</a>
							</div>
							<?php else: ?>
							<div class="col-md-6">
								<a href="<?php echo base_url(); ?>rate_cards/clone_rate_card/<?php echo $rate_card->id; ?>" class="btn btn-secondary btn-block">
									<i class="fa fa-copy"></i> Clone from Another Rate Card
								</a>
							</div>
							<?php endif; ?>
						</div>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Rates List -->
		<?php if(!empty($rates)): ?>
		<div class="row mb-4">
			<div class="col-md-12">
				<div class="card">
					<div class="card-header">
						<h5>
							Rates in this Rate Card 
							<span class="badge badge-primary"><?php echo count($rates); ?></span>
							<div class="float-right">
								<a href="<?php echo base_url(); ?>rates?rate_card_id=<?php echo $rate_card->id; ?>" class="btn btn-sm btn-outline-primary">
									View All Rates
								</a>
							</div>
						</h5>
					</div>
					<div class="card-body">
						<table class="table table-striped table-sm">
							<thead>
								<tr>
									<th>Destination</th>
									<th>Country</th>
									<th>Cost</th>
									<th>Sell Price</th>
									<th>Billing Increment</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								<?php foreach(array_slice($rates, 0, 10) as $rate): ?>
								<tr>
									<td>
										<strong><?php echo $rate->destination_code; ?></strong> - <?php echo $rate->destination_name; ?>
									</td>
									<td>
										<?php if($rate->country): ?>
											<span class="badge badge-secondary"><?php echo $rate->country; ?></span>
										<?php else: ?>
											-
										<?php endif; ?>
									</td>
									<td><strong>$<?php echo number_format($rate->cost_price, 4); ?></strong></td>
									<td>$<?php echo number_format($rate->sell_price, 4); ?></td>
									<td><?php echo $rate->billing_increment; ?>s</td>
									<td>
										<a href="<?php echo base_url(); ?>rates/edit/<?php echo $rate->id; ?>" class="btn btn-warning btn-xs">
											<i class="fa fa-edit"></i>
										</a>
									</td>
								</tr>
								<?php endforeach; ?>
							</tbody>
						</table>
						
						<?php if(count($rates) > 10): ?>
						<div class="text-center">
							<p class="text-muted">Showing first 10 rates out of <?php echo count($rates); ?> total rates.</p>
							<a href="<?php echo base_url(); ?>rates?rate_card_id=<?php echo $rate_card->id; ?>" class="btn btn-primary">
								View All <?php echo count($rates); ?> Rates
							</a>
						</div>
						<?php endif; ?>
					</div>
				</div>
			</div>
		</div>
		<?php else: ?>
		<div class="row mb-4">
			<div class="col-md-12">
				<div class="alert alert-info">
					<h5>No Rates Configured</h5>
					<p>This rate card doesn't have any rates configured yet.</p>
					<p>
						<a href="<?php echo base_url(); ?>rates/add?rate_card_id=<?php echo $rate_card->id; ?>" class="btn btn-success">Add Your First Rate</a>
						<a href="<?php echo base_url(); ?>rates/bulk_upload?rate_card_id=<?php echo $rate_card->id; ?>" class="btn btn-primary">Bulk Upload Rates</a>
					</p>
				</div>
			</div>
		</div>
		<?php endif; ?>
		
		<!-- Assigned Users -->
		<?php if(!empty($users)): ?>
		<div class="row mb-4">
			<div class="col-md-12">
				<div class="card">
					<div class="card-header">
						<h5>
							Users Assigned to this Rate Card 
							<span class="badge badge-success"><?php echo count($users); ?></span>
						</h5>
					</div>
					<div class="card-body">
						<table class="table table-striped table-sm">
							<thead>
								<tr>
									<th>Username</th>
									<th>Name</th>
									<th>Email</th>
									<th>Balance</th>
									<th>Status</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								<?php foreach($users as $user): ?>
								<tr>
									<td><strong><?php echo $user->username; ?></strong></td>
									<td><?php echo $user->first_name . ' ' . $user->last_name; ?></td>
									<td><?php echo $user->email; ?></td>
									<td>
										<span class="badge badge-<?php echo ($user->balance > 0) ? 'success' : 'danger'; ?>">
											$<?php echo number_format($user->balance, 4); ?>
										</span>
									</td>
									<td>
										<span class="badge badge-<?php 
											switch($user->status) {
												case 'active': echo 'success'; break;
												case 'suspended': echo 'warning'; break;
												case 'inactive': echo 'secondary'; break;
												default: echo 'secondary';
											}
										?>">
											<?php echo ucfirst($user->status);?>
										</span>
									</td>
									<td>
										<a href="<?php echo base_url(); ?>users/edit/<?php echo $user->id; ?>" class="btn btn-warning btn-xs">
											<i class="fa fa-edit"></i>
										</a>
									</td>
								</tr>
								<?php endforeach; ?>
							</tbody>
						</table>
					</div>
				</div>
			</div>
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
		// Initialize any additional JavaScript here
	});
  </script>
</body>

</html>