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
        <h3 class="mt-4">Assign Rate Card - <?php echo $user->first_name . ' ' . $user->last_name . '(' . $user->telegram_id . ')'; ?></h3>
		<nav aria-label="breadcrumb">
			<ol class="breadcrumb">
				<li class="breadcrumb-item"><a href="<?php echo base_url(); ?>clients">Clients</a></li>
				<li class="breadcrumb-item active">Assign Rate Card</li>
			</ol>
		</nav>
		<h6 class="mt-4"><?php echo $this->session->flashdata('message');?></h6>
		
		<!-- User Information Card -->
		<div class="card mb-4">
			<div class="card-header">
				<h5>User Information</h5>
			</div>
			<div class="card-body">
				<div class="row">
					<div class="col-md-3">
						<strong>Username:</strong> <?php echo $user->username ? $user->username : $user->telegram_id; ?>
					</div>
					<div class="col-md-3">
						<strong>Email:</strong> <?php echo $user->email; ?>
					</div>
					<div class="col-md-3">
						<strong>Current Balance:</strong> 
						<span class="badge badge-<?php echo ($user->balance > 0) ? 'success' : 'danger'; ?>">
							$<?php echo number_format($user->balance, 4); ?>
						</span>
					</div>
					<div class="col-md-3">
						<strong>Status:</strong> 
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
					</div>
				</div>
				<div class="row mt-2">
					<div class="col-md-6">
						<strong>Current Rate Card:</strong> 
						<?php if($user->rate_card_name): ?>
							<span class="badge badge-info"><?php echo $user->rate_card_name . ' (' . $user->currency . ')'; ?></span>
						<?php else: ?>
							<span class="badge badge-warning">Not Assigned</span>
						<?php endif; ?>
					</div>
					<div class="col-md-6">
						<strong>Member Since:</strong> <?php echo date('Y-m-d', strtotime($user->created_at)); ?>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Rate Card Assignment Form -->
		<div class="row">
			<div class="col-md-8">
				<div class="card">
					<div class="card-header">
						<h5>Select Rate Card</h5>
					</div>
					<div class="card-body">
						<?php $attributes = array('class'=>'form-rate-card');
						echo form_open("clients/assign_rate_card/".$user->id,$attributes);?>
						
						<div class="form-group">
							<label for="rate_card_id">Available Rate Cards <span class="text-danger">*</span></label>
							<select class="form-control" id="rate_card_id" name="rate_card_id" required onchange="showRateCardDetails(this.value)">
								<option value="">Select Rate Card</option>
								<?php foreach($rate_cards as $rate_card): ?>
								<option value="<?php echo $rate_card->id; ?>" 
									data-currency="<?php echo $rate_card->currency; ?>"
									data-provider="<?php echo $rate_card->provider_name; ?>"
									data-description="<?php echo htmlspecialchars($rate_card->description); ?>"
									data-total-rates="<?php echo $rate_card->total_rates; ?>"
									data-assigned-users="<?php echo $rate_card->assigned_users; ?>"
									data-status="<?php echo $rate_card->status; ?>"
									<?php echo ($user->rate_card_id == $rate_card->id) ? 'selected' : ''; ?>>
									<?php echo $rate_card->name . ' (' . $rate_card->currency . ')' . ' - ' . $rate_card->provider_name; ?>
								</option>
								<?php endforeach; ?>
							</select>
						</div>
						
						<div class="form-group">
							<label for="assignment_notes">Assignment Notes (Optional)</label>
							<textarea class="form-control" id="assignment_notes" name="assignment_notes" rows="3" placeholder="Enter any notes about this rate card assignment..."></textarea>
						</div>
						
						<div class="form-check mb-3">
							<input class="form-check-input" type="checkbox" id="notify_user" name="notify_user" value="1" checked>
							<label class="form-check-label" for="notify_user">
								Notify user about rate card change (if Telegram ID is set)
							</label>
						</div>
						
						<hr>
						<button type="submit" class="btn btn-success btn-sm">Assign Rate Card</button>
						<a href="<?php echo base_url();?>clients" class="btn btn-warning btn-sm">Cancel</a>
						<?php echo form_close();?>
					</div>
				</div>
			</div>
			
			<!-- Rate Card Details Panel -->
			<div class="col-md-4">
				<div class="card" id="rate_card_details" style="display: none;">
					<div class="card-header">
						<h5>Rate Card Details</h5>
					</div>
					<div class="card-body">
						<table class="table table-borderless table-sm">
							<tr>
								<td><strong>Name:</strong></td>
								<td id="detail_name">-</td>
							</tr>
							<tr>
								<td><strong>Provider:</strong></td>
								<td id="detail_provider">-</td>
							</tr>
							<tr>
								<td><strong>Currency:</strong></td>
								<td><span class="badge badge-info" id="detail_currency">-</span></td>
							</tr>
							<tr>
								<td><strong>Status:</strong></td>
								<td><span class="badge" id="detail_status">-</span></td>
							</tr>
							<tr>
								<td><strong>Total Rates:</strong></td>
								<td id="detail_total_rates">-</td>
							</tr>
							<tr>
								<td><strong>Assigned Users:</strong></td>
								<td id="detail_assigned_users">-</td>
							</tr>
						</table>
						<div id="detail_description_section" style="display: none;">
							<strong>Description:</strong>
							<p class="small text-muted" id="detail_description"></p>
						</div>
					</div>
				</div>
				
				<!-- Current Assignment Info -->
				<?php if($user->rate_card_name): ?>
				<div class="card mt-3">
					<div class="card-header bg-warning text-dark">
						<h6>Current Assignment</h6>
					</div>
					<div class="card-body">
						<p><strong>Rate Card:</strong> <?php echo $user->rate_card_name; ?></p>
						<p><strong>Currency:</strong> <?php echo $user->currency; ?></p>
						<p class="small text-muted">Changing the rate card will affect future call pricing for this user.</p>
					</div>
				</div>
				<?php endif; ?>
				
				<!-- Quick Actions -->
				<div class="card mt-3">
					<div class="card-header">
						<h6>Quick Actions</h6>
					</div>
					<div class="card-body">
						<a href="<?php echo base_url(); ?>clients/edit/<?php echo $user->id; ?>" class="btn btn-warning btn-block btn-sm">
							<i class="fa fa-edit"></i> Edit Client
						</a>
						<a href="<?php echo base_url(); ?>clients/credit_management/<?php echo $user->id; ?>" class="btn btn-info btn-block btn-sm">
							<i class="fa fa-money"></i> Manage Credit
						</a>
						<a href="<?php echo base_url(); ?>rate_cards" class="btn btn-primary btn-block btn-sm">
							<i class="fa fa-credit-card"></i> Manage Rate Cards
						</a>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Available Rate Cards Table -->
		<div class="row mt-4">
			<div class="col-md-12">
				<div class="card">
					<div class="card-header">
						<h5>Available Rate Cards</h5>
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
									<th>Status</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								<?php foreach ($rate_cards as $rate_card){ ?>
								<tr class="<?php echo ($user->rate_card_id == $rate_card->id) ? 'table-warning' : ''; ?>">
									<td>
										<?php echo $rate_card->name; ?>
										<?php if($user->rate_card_id == $rate_card->id): ?>
											<span class="badge badge-success">Current</span>
										<?php endif; ?>
									</td>
									<td><?php echo $rate_card->provider_name ?: 'N/A'; ?></td>
									<td><span class="badge badge-info"><?php echo $rate_card->currency; ?></span></td>
									<td><?php echo number_format($rate_card->total_rates); ?></td>
									<td><?php echo number_format($rate_card->assigned_users); ?></td>
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
										<?php if($rate_card->status == 'active'): ?>
											<button class="btn btn-success btn-sm" onclick="selectRateCard(<?php echo $rate_card->id; ?>)">
												<i class="fa fa-check"></i> Select
											</button>
										<?php else: ?>
											<button class="btn btn-secondary btn-sm" disabled>
												<i class="fa fa-ban"></i> Inactive
											</button>
										<?php endif; ?>
									</td>
								</tr>
								<?php } ?>
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
		
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
			"pageLength": 10,
			"responsive": true,
			"columnDefs": [
				{ "orderable": false, "targets": 6 } // Disable sorting on Actions column
			]
		});
		
		// Show current rate card details if one is selected
		var currentRateCard = $('#rate_card_id').val();
		if(currentRateCard){
			showRateCardDetails(currentRateCard);
		}
	});
	
	function showRateCardDetails(rateCardId){
		if(!rateCardId){
			$('#rate_card_details').hide();
			return;
		}
		
		var option = $('#rate_card_id option[value="' + rateCardId + '"]');
		if(option.length){
			$('#detail_name').text(option.text().split(' (')[0]);
			$('#detail_provider').text(option.data('provider') || 'N/A');
			$('#detail_currency').text(option.data('currency'));
			$('#detail_total_rates').text(number_format(option.data('total-rates') || 0));
			$('#detail_assigned_users').text(number_format(option.data('assigned-users') || 0));
			
			var status = option.data('status');
			var statusClass = 'badge-secondary';
			switch(status){
				case 'active': statusClass = 'badge-success'; break;
				case 'inactive': statusClass = 'badge-secondary'; break;
				case 'draft': statusClass = 'badge-warning'; break;
			}
			$('#detail_status').removeClass().addClass('badge ' + statusClass).text(ucfirst(status));
			
			var description = option.data('description');
			if(description){
				$('#detail_description').text(description);
				$('#detail_description_section').show();
			} else {
				$('#detail_description_section').hide();
			}
			
			$('#rate_card_details').show();
		}
	}
	
	function selectRateCard(rateCardId){
		$('#rate_card_id').val(rateCardId);
		showRateCardDetails(rateCardId);
		$('#assignment_notes').val('Rate card selected from table on ' + new Date().toLocaleString());
	}
	
	function number_format(num){
		return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	}
	
	function ucfirst(str){
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
  </script>

</body>

</html>