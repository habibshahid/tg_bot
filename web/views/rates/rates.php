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
			Rates Management 
			<div class="float-right">
				<a href="<?php echo base_url();?>rates/add" class="btn btn-success btn-sm">
					<i class="fa fa-plus"></i> Add New Rate
				</a>
				<a href="<?php echo base_url();?>rates/bulk_upload" class="btn btn-primary btn-sm">
					<i class="fa fa-upload"></i> Bulk Upload
				</a>
			</div>
		</h3>
		<h6 class="mt-4"><?php echo $this->session->flashdata('message');?></h6>
		
		<!-- Filter Panel -->
		<div class="card mb-4">
			<div class="card-header">
				<h5>Filter Rates</h5>
			</div>
			<div class="card-body">
				<?php echo form_open(base_url().'rates', array('method' => 'GET', 'class' => 'form-inline')); ?>
					<div class="form-group mr-3">
						<label for="rate_card_id" class="mr-2">Rate Card:</label>
						<select class="form-control" id="rate_card_id" name="rate_card_id" onchange="this.form.submit()">
							<option value="">All Rate Cards</option>
							<?php foreach($rate_cards as $rate_card): ?>
							<option value="<?php echo $rate_card->id; ?>" <?php echo ($selected_rate_card == $rate_card->id) ? 'selected' : ''; ?>>
								<?php echo $rate_card->name . ' (' . $rate_card->currency . ')'; ?>
							</option>
							<?php endforeach; ?>
						</select>
					</div>
					
					<?php if($selected_rate_card): ?>
					<div class="form-group mr-3">
						<a href="<?php echo base_url(); ?>rates/export_rates?rate_card_id=<?php echo $selected_rate_card; ?>" class="btn btn-info btn-sm">
							<i class="fa fa-download"></i> Export CSV
						</a>
					</div>
					<?php endif; ?>
					
					<div class="form-group">
						<a href="<?php echo base_url(); ?>rates" class="btn btn-secondary btn-sm">
							<i class="fa fa-refresh"></i> Clear Filter
						</a>
					</div>
				<?php echo form_close(); ?>
			</div>
		</div>
		
		<!-- Statistics Cards -->
		<?php if($selected_rate_card): ?>
		<div class="row mb-4">
			<div class="col-xl-3 col-md-6">
				<div class="card bg-primary text-white mb-4">
					<div class="card-body">
						<h4><?php echo count($rates); ?></h4>
						<p>Total Rates</p>
					</div>
				</div>
			</div>
			<div class="col-xl-3 col-md-6">
				<div class="card bg-success text-white mb-4">
					<div class="card-body">
						<h4>$<?php echo number_format(array_sum(array_column($rates, 'rate')) / max(count($rates), 1), 4); ?></h4>
						<p>Average Rate</p>
					</div>
				</div>
			</div>
			<div class="col-xl-3 col-md-6">
				<div class="card bg-info text-white mb-4">
					<div class="card-body">
						<h4>$<?php echo number_format(min(array_column($rates, 'rate') ?: [0]), 4); ?></h4>
						<p>Minimum Rate</p>
					</div>
				</div>
			</div>
			<div class="col-xl-3 col-md-6">
				<div class="card bg-warning text-white mb-4">
					<div class="card-body">
						<h4>$<?php echo number_format(max(array_column($rates, 'rate') ?: [0]), 4); ?></h4>
						<p>Maximum Rate</p>
					</div>
				</div>
			</div>
		</div>
		<?php endif; ?>
		
		<div class="card">
			<div class="card-header">
				<h5>
					Rates List 
					<?php if($selected_rate_card): ?>
						<?php 
						$selected_card = null;
						foreach($rate_cards as $rc) {
							if($rc->id == $selected_rate_card) {
								$selected_card = $rc;
								break;
							}
						}
						if($selected_card): ?>
						- <span class="badge badge-info"><?php echo $selected_card->name; ?></span>
						<?php endif; ?>
					<?php endif; ?>
				</h5>
			</div>
			<div class="card-body">
				<table id="rates_table" class="table table-striped table-bordered" style="width:100%">
					<thead>
						<tr>
							<th>Destination Code</th>
							<th>Destination Name</th>
							<th>Country</th>
							<th>Rate Card</th>
							<th>Cost</th>
							<th>Price</th>
							<th>Increment</th>
							<th>Min Duration</th>
							<th>Effective Date</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						<?php foreach ($rates as $rate){ ?>
						<tr>
							<td>
								<strong><?php echo $rate->destination_code;?></strong>
							</td>
							<td><?php echo $rate->destination_name;?></td>
							<td>
								<?php if($rate->country): ?>
									<span class="badge badge-secondary"><?php echo $rate->country; ?></span>
								<?php else: ?>
									-
								<?php endif; ?>
							</td>
							<td>
								<span class="badge badge-info">
									<?php echo $rate->rate_card_name . ' (' . $rate->currency . ')'; ?>
								</span>
							</td>
							
							<td>
								<strong class="text-success">
									$<?php echo number_format($rate->cost_price, 4) ;?>
								</strong>
							</td>
							<td>
								<strong class="text-success">
									$<?php echo number_format($rate->sell_price, 4) ;?>
								</strong>
							</td>
							<td>
								<?php echo $rate->billing_increment; ?>s
							</td>
							<td>
								<?php echo $rate->minimum_duration; ?>s
							</td>
							<td>
								<?php echo date('Y-m-d', strtotime($rate->effective_from)); ?>
								<?php if($rate->effective_to): ?>
									<br><small class="text-muted">Expires: <?php echo date('Y-m-d', strtotime($rate->effective_to)); ?></small>
								<?php endif; ?>
							</td>
							<td>
								<div class="btn-group" role="group">
									<a href="<?php echo base_url();?>rates/edit/<?php echo $rate->id;?>" class="btn btn-warning btn-sm" title="Edit Rate">
										<i class="fa fa-edit"></i>
									</a>
									<a href="<?php echo base_url();?>rates/delete/<?php echo $rate->id;?>" class="btn btn-danger btn-sm" title="Delete Rate">
										<i class="fa fa-times"></i>
									</a>
								</div>
							</td>
						</tr>
						<?php } ?>
					</tbody>
				</table>
			</div>
		</div>
		
		<?php if(empty($rates)): ?>
		<div class="alert alert-info mt-3">
			<h5>No rates found</h5>
			<p>
				<?php if($selected_rate_card): ?>
					No rates have been configured for the selected rate card.
				<?php else: ?>
					No rates have been configured in the system.
				<?php endif; ?>
			</p>
			<p>
				<a href="<?php echo base_url(); ?>rates/add" class="btn btn-primary">Add Your First Rate</a>
				<a href="<?php echo base_url(); ?>rates/bulk_upload" class="btn btn-info">Bulk Upload Rates</a>
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
		$('#rates_table').DataTable({
			"order": [[ 1, "asc" ]],
			"pageLength": 25,
			"responsive": true,
			"columnDefs": [
				{ "orderable": false, "targets": 9 }, // Disable sorting on Actions column
				{ "type": "currency", "targets": [4, 5] } // Currency sorting for rate columns
			],
			"language": {
				"search": "Search rates:",
				"lengthMenu": "Show _MENU_ rates per page",
				"info": "Showing _START_ to _END_ of _TOTAL_ rates"
			}
		});
	  });
  </script>
</body>

</html>