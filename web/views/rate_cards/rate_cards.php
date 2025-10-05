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
			Rate Cards Management 
			<div class="float-right">
				<a href="<?php echo base_url();?>rate_cards/add" class="btn btn-success btn-sm">
					<i class="fa fa-plus"></i> Add New Rate Card
				</a>
			</div>
		</h3>
		<h6 class="mt-4"><?php echo $this->session->flashdata('message');?></h6>
		
		<!-- Statistics Cards -->
		<div class="row mb-4">
			<div class="col-xl-3 col-md-6">
				<div class="card bg-primary text-white mb-4">
					<div class="card-body">
						<h4><?php echo count($rate_cards); ?></h4>
						<p>Total Rate Cards</p>
					</div>
				</div>
			</div>
			<div class="col-xl-3 col-md-6">
				<div class="card bg-success text-white mb-4">
					<div class="card-body">
						<h4><?php echo count(array_filter($rate_cards, function($rc) { return $rc->status == 'active'; })); ?></h4>
						<p>Active Rate Cards</p>
					</div>
				</div>
			</div>
			<div class="col-xl-3 col-md-6">
				<div class="card bg-info text-white mb-4">
					<div class="card-body">
						<h4><?php echo array_sum(array_column($rate_cards, 'total_rates')); ?></h4>
						<p>Total Rates</p>
					</div>
				</div>
			</div>
			<div class="col-xl-3 col-md-6">
				<div class="card bg-warning text-white mb-4">
					<div class="card-body">
						<h4><?php echo array_sum(array_column($rate_cards, 'assigned_users')); ?></h4>
						<p>Assigned Users</p>
					</div>
				</div>
			</div>
		</div>
		
		<div class="card">
			<div class="card-header">
				<h5>Rate Cards List</h5>
			</div>
			<div class="card-body">
				<table id="rate_cards_table" class="table table-striped table-bordered" style="width:100%">
					<thead>
						<tr>
							<th>Name</th>
							<th>Provider</th>
							<th>Currency</th>
							<th>Total Rates</th>
							<th>Assigned Users</th>
							<th>Effective Date</th>
							<th>Status</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						<?php foreach ($rate_cards as $rate_card){ ?>
						<tr>
							<td>
								<strong><?php echo $rate_card->name;?></strong>
								<?php if($rate_card->description): ?>
									<br><small class="text-muted"><?php echo substr($rate_card->description, 0, 50) . (strlen($rate_card->description) > 50 ? '...' : ''); ?></small>
								<?php endif; ?>
							</td>
							<td>
								<?php if($rate_card->provider_name): ?>
									<span class="badge badge-secondary"><?php echo $rate_card->provider_name; ?></span>
								<?php else: ?>
									<span class="text-muted">No Provider</span>
								<?php endif; ?>
							</td>
							<td>
								<span class="badge badge-info"><?php echo $rate_card->currency; ?></span>
							</td>
							<td>
								<span class="badge badge-<?php echo ($rate_card->total_rates > 0) ? 'success' : 'secondary'; ?>">
									<?php echo number_format($rate_card->total_rates); ?>
								</span>
								<?php if($rate_card->total_rates > 0): ?>
									<br><small class="text-muted">
										<a href="<?php echo base_url(); ?>rates?rate_card_id=<?php echo $rate_card->id; ?>" class="text-info">
											View Rates
										</a>
									</small>
								<?php endif; ?>
							</td>
							<td>
								<span class="badge badge-<?php echo ($rate_card->assigned_users > 0) ? 'primary' : 'secondary'; ?>">
									<?php echo number_format($rate_card->assigned_users); ?>
								</span>
								<?php if($rate_card->assigned_users > 0): ?>
									<br><small class="text-muted">
										<a href="<?php echo base_url(); ?>clients?rate_card_id=<?php echo $rate_card->id; ?>" class="text-info">
											View Users
										</a>
									</small>
								<?php endif; ?>
							</td>
							<td>
								<?php echo date('Y-m-d', strtotime($rate_card->effective_from)); ?>
								<?php if($rate_card->effective_to): ?>
									<br><small class="text-muted">Expires: <?php echo date('Y-m-d', strtotime($rate_card->effective_to)); ?></small>
								<?php endif; ?>
							</td>
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
							<td>
								<div class="btn-group" role="group">
									<a href="<?php echo base_url();?>rate_cards/view/<?php echo $rate_card->id;?>" class="btn btn-info btn-sm" title="View Details">
										<i class="fa fa-eye"></i>
									</a>
									<a href="<?php echo base_url();?>rate_cards/edit/<?php echo $rate_card->id;?>" class="btn btn-warning btn-sm" title="Edit Rate Card">
										<i class="fa fa-edit"></i>
									</a>
									<div class="btn-group" role="group">
										<button type="button" class="btn btn-primary btn-sm dropdown-toggle" data-toggle="dropdown" title="More Actions">
											<i class="fa fa-cog"></i>
										</button>
										<div class="dropdown-menu">
											<a class="dropdown-item" href="<?php echo base_url();?>rate_cards/clone_rate_card/<?php echo $rate_card->id;?>">
												<i class="fa fa-copy"></i> Clone Rate Card
											</a>
											<?php if($rate_card->total_rates > 0): ?>
											<a class="dropdown-item" href="<?php echo base_url();?>rate_cards/bulk_update_rates/<?php echo $rate_card->id;?>">
												<i class="fa fa-edit"></i> Bulk Update Rates
											</a>
											<a class="dropdown-item" href="<?php echo base_url();?>rates/export_rates?rate_card_id=<?php echo $rate_card->id;?>">
												<i class="fa fa-download"></i> Export Rates
											</a>
											<?php endif; ?>
											<div class="dropdown-divider"></div>
											<a class="dropdown-item text-danger" href="<?php echo base_url();?>rate_cards/delete/<?php echo $rate_card->id;?>">
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
		
		<?php if(empty($rate_cards)): ?>
		<div class="alert alert-info mt-3">
			<h5>No rate cards found</h5>
			<p>No rate cards have been configured in the system yet.</p>
			<p>
				<a href="<?php echo base_url(); ?>rate_cards/add" class="btn btn-primary">Create Your First Rate Card</a>
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
		$('#rate_cards_table').DataTable({
			"order": [[ 0, "asc" ]],
			"pageLength": 25,
			"responsive": true,
			"columnDefs": [
				{ "orderable": false, "targets": 7 }, // Disable sorting on Actions column
				{ "type": "date", "targets": 5 } // Date sorting for effective date
			],
			"language": {
				"search": "Search rate cards:",
				"lengthMenu": "Show _MENU_ rate cards per page",
				"info": "Showing _START_ to _END_ of _TOTAL_ rate cards"
			}
		});
	  });
  </script>
</body>

</html>