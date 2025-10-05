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
        <h3 class="mt-4">Edit Rate - <?php echo $fields->destination_name; ?></h3>
		<nav aria-label="breadcrumb">
			<ol class="breadcrumb">
				<li class="breadcrumb-item"><a href="<?php echo base_url(); ?>rates">Rates</a></li>
				<li class="breadcrumb-item active">Edit Rate</li>
			</ol>
		</nav>
		<h6 class="mt-4"><?php echo $this->session->flashdata('message');?></h6>
		
		<?php $attributes = array('class'=>'form-signin');
		echo form_open("rates/edit/".$fields->id,$attributes);?>
		<input type="hidden" name="rate_id" value="<?php echo $fields->id; ?>">
		
			<!-- Current Rate Information -->
			<div class="card mb-4">
				<div class="card-header bg-info text-white">
					<h5>Current Rate Information | Rate Card: <?php echo $fields->rate_card_name; ?></h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="col-md-3">
							<div class="card bg-primary text-white">
								<div class="card-body text-center">
									<h4><?php echo $fields->destination_code; ?></h4>
									<p>Destination Code</p>
								</div>
							</div>
						</div>
						<div class="col-md-3">
							<div class="card bg-secondary text-white">
								<div class="card-body text-center">
									<h4>$<?php echo number_format($fields->cost_price, 4); ?></h4>
									<p>Current Cost</p>
								</div>
							</div>
						</div>
						<div class="col-md-3">
							<div class="card bg-success text-white">
								<div class="card-body text-center">
									<h4>$<?php echo number_format($fields->sell_price, 4); ?></h4>
									<p>Current Price</p>
								</div>
							</div>
						</div>
	
						<div class="col-md-3">
							<div class="card bg-info text-white">
								<div class="card-body text-center">
									<h4><?php echo $fields->country ?: 'N/A'; ?></h4>
									<p>Country</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		
			<!-- Rate Card Selection -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Rate Card Selection</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Rate Card <span class="text-danger">*</span></label>
							<select class="form-control" id="rate_card_id" name="rate_card_id" required onchange="showRateCardInfo(this.value)">
								<option value="">Select Rate Card</option>
								<?php foreach($rate_cards as $rate_card): ?>
								<option value="<?php echo $rate_card->id; ?>" 
									data-currency="<?php echo $rate_card->currency; ?>"
									data-provider="<?php echo $rate_card->provider_name; ?>"
									<?php echo set_select('rate_card_id', $rate_card->id, ($fields->rate_card_id == $rate_card->id)); ?>>
									<?php echo $rate_card->name . ' (' . $rate_card->currency . ')' . ' - ' . $rate_card->provider_name; ?>
								</option>
								<?php endforeach; ?>
							</select>
						</div>
						<div class="col-md-6" id="rate_card_info">
							<div class="alert alert-info">
								<strong>Selected Rate Card:</strong> <span id="selected_rate_card_name"><?php echo $fields->rate_card_name; ?></span><br>
								<strong>Currency:</strong> <span id="selected_currency"><?php echo $fields->currency; ?></span><br>
								<strong>Provider:</strong> <span id="selected_provider">-</span>
							</div>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Destination Selection -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Destination Selection</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Destination <span class="text-danger">*</span></label>
							<select class="form-control" id="destination_id" name="destination_id" required onchange="showDestinationInfo(this.value)">
								<option value="">Select Destination</option>
								<?php foreach($destinations as $destination): ?>
								<option value="<?php echo $destination->id; ?>"
									data-code="<?php echo $destination->prefix; ?>"
									data-country="<?php echo $destination->country_name; ?>"
									<?php echo set_select('destination_id', $destination->id, ($fields->destination_id == $destination->id)); ?>>
									<?php echo $destination->prefix . ' - ' . $destination->country_name . ($destination->description ? ' (' . $destination->description . ')' : ''); ?>
								</option>
								<?php endforeach; ?>
							</select>
						</div>
						<div class="col-md-6" id="destination_info">
							<div class="alert alert-info">
								<strong>Destination Code:</strong> <span id="selected_dest_code"><?php echo $fields->destination_code; ?></span><br>
								<strong>Country:</strong> <span id="selected_country"><?php echo $fields->destination_name ?: 'N/A'; ?></span><br>
							</div>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Rate Configuration -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Rate Configuration</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Cost per Minute <span class="text-danger">*</span></label>
							<div class="input-group">
								<div class="input-group-prepend">
									<span class="input-group-text" id="currency_symbol">$</span>
								</div>
								<input class="form-control" id="cost_price" name="cost_price" type="number" step="0.0001" placeholder="0.0000" value="<?php echo set_value('cost_price', $fields->cost_price); ?>" required />
							</div>
							<small class="form-text text-muted">Enter the cost per minute for calls to this destination</small>
						</div>
						<div class="form-group col-md-6">
							<label>Price per Minute <span class="text-danger">*</span></label>
							<div class="input-group">
								<div class="input-group-prepend">
									<span class="input-group-text" id="currency_symbol">$</span>
								</div>
								<input class="form-control" id="sell_price" name="sell_price" type="number" step="0.0001" placeholder="0.0000" value="<?php echo set_value('sell_price', $fields->sell_price); ?>" required />
							</div>
							<small class="form-text text-muted">Enter the selling per minute for calls to this destination</small>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Billing Configuration -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Billing Configuration</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Billing Increment (seconds) <span class="text-danger">*</span></label>
							<select class="form-control" id="billing_increment" name="billing_increment" required>
								<option value="1" <?php echo set_select('billing_increment', '1', ($fields->billing_increment == 1)); ?>>1 second</option>
								<option value="6" <?php echo set_select('billing_increment', '6', ($fields->billing_increment == 6)); ?>>6 seconds</option>
								<option value="30" <?php echo set_select('billing_increment', '30', ($fields->billing_increment == 30)); ?>>30 seconds</option>
								<option value="60" <?php echo set_select('billing_increment', '60', ($fields->billing_increment == 60)); ?>>60 seconds (1 minute)</option>
							</select>
							<small class="form-text text-muted">Calls will be billed in these increments</small>
						</div>
						<div class="form-group col-md-6">
							<label>Minimum Duration (seconds) <span class="text-danger">*</span></label>
							<select class="form-control" id="minimum_duration" name="minimum_duration" required>
								<option value="0" <?php echo set_select('minimum_duration', '0', ($fields->minimum_duration == 0)); ?>>No minimum</option>
								<option value="30" <?php echo set_select('minimum_duration', '30', ($fields->minimum_duration == 30)); ?>>30 seconds</option>
								<option value="60" <?php echo set_select('minimum_duration', '60', ($fields->minimum_duration == 60)); ?>>60 seconds (1 minute)</option>
								<option value="120" <?php echo set_select('minimum_duration', '120', ($fields->minimum_duration == 120)); ?>>120 seconds (2 minutes)</option>
							</select>
							<small class="form-text text-muted">Minimum billable duration for each call</small>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Effective Dates -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Effective Dates</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Effective Date <span class="text-danger">*</span></label>
							<input class="form-control" id="effective_from" name="effective_from" type="date" value="<?php echo set_value('effective_from', explode(' ', $fields->effective_from)[0]); ?>" required />
							<small class="form-text text-muted">Date when this rate becomes active</small>
						</div>
						<div class="form-group col-md-6">
							<label>Expiry Date</label>
							<input class="form-control" id="effective_to" name="effective_to" type="date" value="<?php echo set_value('effective_to', explode(' ', $fields->effective_to)[0]); ?>" />
							<small class="form-text text-muted">Optional: Date when this rate expires</small>
						</div>
					</div>
				</div>
			</div>
			
			<hr>
			<button type="submit" class="btn btn-success btn-sm">Update Rate</button>
			<a href="<?php echo base_url();?>rates" class="btn btn-warning btn-sm">Cancel</a>
			<a href="<?php echo base_url();?>rates/delete/<?php echo $fields->id; ?>" class="btn btn-danger btn-sm">Delete Rate</a>
			<br><br><br><br>
		<?php echo form_close();?>
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->

  <?php $this->load->view('templates/footer'); ?>
  
  <script>
	
  </script>

</body>

</html>