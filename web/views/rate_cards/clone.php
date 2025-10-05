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
        <h3 class="mt-4">Clone Rate Card - <?php echo $source_rate_card->name; ?></h3>
		<nav aria-label="breadcrumb">
			<ol class="breadcrumb">
				<li class="breadcrumb-item"><a href="<?php echo base_url(); ?>rate_cards">Rate Cards</a></li>
				<li class="breadcrumb-item"><a href="<?php echo base_url(); ?>rate_cards/view/<?php echo $source_rate_card->id; ?>"><?php echo $source_rate_card->name; ?></a></li>
				<li class="breadcrumb-item active">Clone</li>
			</ol>
		</nav>
		<h6 class="mt-4"><?php echo $this->session->flashdata('message');?></h6>
		
		<!-- Source Rate Card Information -->
		<div class="card mb-4">
			<div class="card-header bg-info text-white">
				<h5>Source Rate Card Information</h5>
			</div>
			<div class="card-body">
				<div class="row">
					<div class="col-md-6">
						<div class="card bg-primary text-white">
							<div class="card-body text-center">
								<h4><?php echo $source_rate_card->name; ?></h4>
								<p>Source Rate Card</p>
							</div>
						</div>
					</div>
					<div class="col-md-6">
						<div class="card bg-success text-white">
							<div class="card-body text-center">
								<h4><?php echo $source_rate_card->currency; ?></h4>
								<p>Currency</p>
							</div>
						</div>
					</div>
					
				</div>
				
				<div class="row mt-3">
					<div class="col-md-12">
						<table class="table table-borderless">
							<tr>
								<td><strong>Provider:</strong></td>
								<td><?php echo $source_rate_card->provider_name ?: 'No Provider'; ?></td>
								<td><strong>Status:</strong></td>
								<td>
									<span class="badge badge-<?php 
										switch($source_rate_card->status) {
											case 'active': echo 'success'; break;
											case 'inactive': echo 'secondary'; break;
											case 'draft': echo 'warning'; break;
											default: echo 'secondary';
										}
									?>">
										<?php echo ucfirst($source_rate_card->status);?>
									</span>
								</td>
							</tr>
							
						</table>
						
						<?php if($source_rate_card->description): ?>
						<div class="mt-2">
							<strong>Description:</strong> 
							<span class="text-muted"><?php echo $source_rate_card->description; ?></span>
						</div>
						<?php endif; ?>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Clone Configuration Form -->
		<?php $attributes = array('class'=>'form-signin');
		echo form_open("rate_cards/clone_rate_card/".$source_rate_card->id,$attributes);?>
		
			<!-- New Rate Card Details -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>New Rate Card Details</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>New Rate Card Name <span class="text-danger">*</span></label>
							<input class="form-control" id="name" name="name" placeholder="Enter new rate card name" value="<?php echo set_value('name', 'Copy of ' . $source_rate_card->name); ?>" required />
							<small class="form-text text-muted">Choose a unique name for the cloned rate card</small>
						</div>
						<div class="form-group col-md-6">
							<label>Provider <span class="text-danger">*</span></label>
							<select class="form-control" id="provider_id" name="provider_id" required onchange="showProviderInfo(this.value)">
								<option value="">Select Provider</option>
								<?php foreach($providers as $provider): ?>
								<option value="<?php echo $provider->id; ?>" 
									data-description="<?php echo htmlspecialchars($provider->description); ?>"
									data-name="<?php echo htmlspecialchars($provider->name); ?>"
									<?php echo set_select('provider_id', $provider->id, ($source_rate_card->provider_id == $provider->id)); ?>>
									<?php echo $provider->name; ?>
								</option>
								<?php endforeach; ?>
							</select>
						</div>
					</div>
					
					<div class="row">
						<div class="form-group col-md-12">
							<label>Description</label>
							<textarea class="form-control" id="description" name="description" rows="3" placeholder="Enter description for the new rate card..."><?php echo set_value('description', 'Cloned from: ' . $source_rate_card->name); ?></textarea>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Clone Configuration -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Clone Configuration</h5>
				</div>
				<div class="card-body">
					<div class="row">
						<div class="form-group col-md-6">
							<label>Currency <span class="text-danger">*</span></label>
							<select class="form-control" id="currency" name="currency" required onchange="updateCurrencyInfo(this.value)">
								<option value="">Select Currency</option>
								<option value="USD" <?php echo set_select('currency', 'USD', ($source_rate_card->currency == 'USD')); ?>>USD - US Dollar</option>
								<option value="EUR" <?php echo set_select('currency', 'EUR', ($source_rate_card->currency == 'EUR')); ?>>EUR - Euro</option>
								<option value="GBP" <?php echo set_select('currency', 'GBP', ($source_rate_card->currency == 'GBP')); ?>>GBP - British Pound</option>
								<option value="PKR" <?php echo set_select('currency', 'PKR', ($source_rate_card->currency == 'PKR')); ?>>PKR - Pakistani Rupee</option>
								<option value="AED" <?php echo set_select('currency', 'AED', ($source_rate_card->currency == 'AED')); ?>>AED - UAE Dirham</option>
								<option value="CAD" <?php echo set_select('currency', 'CAD', ($source_rate_card->currency == 'CAD')); ?>>CAD - Canadian Dollar</option>
								<option value="AUD" <?php echo set_select('currency', 'AUD', ($source_rate_card->currency == 'AUD')); ?>>AUD - Australian Dollar</option>
								<option value="INR" <?php echo set_select('currency', 'INR', ($source_rate_card->currency == 'INR')); ?>>INR - Indian Rupee</option>
							</select>
						</div>
						<div class="form-group col-md-6">
							<label>Status</label>
							<select class="form-control" id="status" name="status" required>
								<option value="draft" <?php echo set_select('status', 'draft', TRUE); ?>>Draft</option>
								<option value="active" <?php echo set_select('status', 'active'); ?>>Active</option>
								<option value="inactive" <?php echo set_select('status', 'inactive'); ?>>Inactive</option>
							</select>
							<small class="form-text text-muted">Cloned rate cards typically start as Draft</small>
						</div>
					</div>
					
					<div class="row">
						<div class="form-group col-md-6">
							<label>Effective Date <span class="text-danger">*</span></label>
							<input class="form-control" id="effective_from" name="effective_from" type="date" value="<?php echo set_value('effective_date', date('Y-m-d')); ?>" required />
						</div>
						<div class="form-group col-md-6">
							<label>Expiry Date</label>
							<input class="form-control" id="effective_to" name="effective_to" type="date" value="<?php echo set_value('effective_to'); ?>" />
						</div>
					</div>
					
					<div class="row">
						<div class="col-md-12">
							<div class="form-check">
								<input class="form-check-input" type="checkbox" id="no_expiry" name="no_expiry" value="1" checked>
								<label class="form-check-label" for="no_expiry">
									This rate card does not expire
								</label>
							</div>
						</div>
					</div>
				</div>
			</div>
			
			<!-- Rate Modification Options -->
			<div class="card mb-4">
				<div class="card-header">
					<h5>Rate Modification Options</h5>
				</div>
				<div class="card-body">
					<div class="alert alert-info">
						<strong>Note:</strong> You can modify the rates during the cloning process or leave them as-is and modify later.
					</div>
					
					<div class="form-check mb-3">
						<input class="form-check-input" type="radio" id="no_modification" name="rate_modification" value="none" checked>
						<label class="form-check-label" for="no_modification">
							<strong>Copy rates as-is</strong> - No modifications
						</label>
					</div>
					
					<div class="form-check mb-3">
						<input class="form-check-input" type="radio" id="percentage_increase" name="rate_modification" value="percentage_increase">
						<label class="form-check-label" for="percentage_increase">
							<strong>Increase all rates by percentage</strong>
						</label>
						<div class="ml-4 mt-2" id="percentage_increase_options" style="display: none;">
							<div class="input-group" style="width: 200px;">
								<input type="number" class="form-control" id="increase_percentage" name="increase_percentage" step="0.01" placeholder="5.00">
								<div class="input-group-append">
									<span class="input-group-text">%</span>
								</div>
							</div>
						</div>
					</div>
					
					<div class="form-check mb-3">
						<input class="form-check-input" type="radio" id="percentage_decrease" name="rate_modification" value="percentage_decrease">
						<label class="form-check-label" for="percentage_decrease">
							<strong>Decrease all rates by percentage</strong>
						</label>
						<div class="ml-4 mt-2" id="percentage_decrease_options" style="display: none;">
							<div class="input-group" style="width: 200px;">
								<input type="number" class="form-control" id="decrease_percentage" name="decrease_percentage" step="0.01" placeholder="10.00">
								<div class="input-group-append">
									<span class="input-group-text">%</span>
								</div>
							</div>
						</div>
					</div>
					
					<div class="form-check mb-3">
						<input class="form-check-input" type="radio" id="fixed_adjustment" name="rate_modification" value="fixed_adjustment">
						<label class="form-check-label" for="fixed_adjustment">
							<strong>Add/subtract fixed amount</strong>
						</label>
						<div class="ml-4 mt-2" id="fixed_adjustment_options" style="display: none;">
							<div class="input-group" style="width: 200px;">
								<div class="input-group-prepend">
									<span class="input-group-text" id="currency_symbol">$</span>
								</div>
								<input type="number" class="form-control" id="fixed_amount" name="fixed_amount" step="0.0001" placeholder="0.0050">
							</div>
							<small class="text-muted">Use negative values to subtract</small>
						</div>
					</div>
				</div>
			</div>
			
			
			
			<hr>
			<button type="submit" class="btn btn-success btn-sm" id="clone_btn">
				<i class="fa fa-copy"></i> Clone Rate Card
			</button>
			<a href="<?php echo base_url();?>rate_cards/view/<?php echo $source_rate_card->id; ?>" class="btn btn-warning btn-sm">Cancel</a>
			<br><br><br><br>
		<?php echo form_close();?>
      </div>
    </div>
    <!-- /#page-content-wrapper -->

  </div>
  <!-- /#wrapper -->

  <?php $this->load->view('templates/footer'); ?>
  
  <script>
	$(document).ready(function(){
		// Show/hide rate modification options
		$('input[name="rate_modification"]').change(function(){
			$('.ml-4').hide();
			if($(this).val() === 'percentage_increase'){
				$('#percentage_increase_options').show();
			} else if($(this).val() === 'percentage_decrease'){
				$('#percentage_decrease_options').show();
			} else if($(this).val() === 'fixed_adjustment'){
				$('#fixed_adjustment_options').show();
			}
			updateSummary();
		});
		
		// Update summary when values change
		$('#name, #currency, #status').on('input change', updateSummary);
		$('input[name="rate_modification"], #increase_percentage, #decrease_percentage, #fixed_amount').on('input change', updateSummary);
		
		// Handle no expiry checkbox
		$('#no_expiry').change(function(){
			if($(this).is(':checked')){
				$('#expiry_date').val('').prop('disabled', true);
			} else {
				$('#expiry_date').prop('disabled', false);
			}
		});
	});
	
	function showProviderInfo(providerId){
		// Provider info functionality if needed
	}
	
	function updateCurrencyInfo(currency){
		var symbols = {
			'USD': '$', 'EUR': '€', 'GBP': '£', 'PKR': '₨', 'AED': 'د.إ',
			'CAD': 'C$', 'AUD': 'A$', 'INR': '₹'
		};
		$('#currency_symbol').text(symbols[currency] || '$');
	}
	
	function updateSummary(){
		var name = $('#name').val();
		var currency = $('#currency').val();
		var status = $('#status').val();
		var modification = $('input[name="rate_modification"]:checked').val();
		
		if(!name || !currency || !status){
			$('#clone_summary').hide();
			return;
		}
		
		$('#summary_name').text(name);
		$('#summary_currency').text(currency);
		$('#summary_status').text(ucfirst(status));
		
		var modText = 'No modifications';
		if(modification === 'percentage_increase'){
			var percent = $('#increase_percentage').val();
			modText = 'Increase by ' + (percent || '0') + '%';
		} else if(modification === 'percentage_decrease'){
			var percent = $('#decrease_percentage').val();
			modText = 'Decrease by ' + (percent || '0') + '%';
		} else if(modification === 'fixed_adjustment'){
			var amount = $('#fixed_amount').val();
			modText = 'Adjust by $' + (amount || '0');
		}
		$('#summary_modification').text(modText);
		
		$('#clone_summary').show();
	}
	
	function ucfirst(str){
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
  </script>

</body>

</html>